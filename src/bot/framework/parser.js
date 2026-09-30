// Prefix-command argument parser. Pure: no SDK, no I/O — resolving user /
// channel / role references to objects happens afterwards (resolve.js).
//
// Rules, in order:
//   1. Tokens are whitespace-separated; "double" or 'single' quotes group, and
//      a backslash escapes the next character.
//   2. For a command with subcommands, the first token names the subcommand.
//   3. `name:value` sets an option by name anywhere in the text (value may be
//      quoted), so optional options can be given out of order.
//   4. Remaining tokens fill options left to right. "Typed" options (integer,
//      boolean, user/channel/role, a string with choices or a pattern) take a
//      token only if it fits; an optional one that doesn't fit is skipped. A
//      token met while the next option is free text is first offered to a later
//      typed option it clearly fits (so `!ban @x 1d spam` sets the duration).
//   5. The last free-text string option takes the rest of the text verbatim,
//      minus trailing tokens that clearly fit later typed options
//      (`!poll "Pick one" "A | B" 1h` → the duration is peeled off the end).
//   6. A choice whose name has spaces may span several tokens, unquoted:
//      `!stats Battlefield 6 PC name` picks "Battlefield 6". The longest match wins.
import { OptionType } from './CommandBuilder.js';

const TRUE_WORDS = new Set(['yes', 'y', 'true', 'on', '1', 'ja', 'enable', 'enabled']);
const FALSE_WORDS = new Set(['no', 'n', 'false', 'off', '0', 'nei', 'disable', 'disabled']);
const USER_MENTION = /^<@!?(\d{17,20})>$/;
const ROLE_MENTION = /^<@&(\d{17,20})>$/;
const CHANNEL_MENTION = /^<#(\d{17,20})>$/;
const SNOWFLAKE = /^\d{17,20}$/;
const INTEGER = /^[-+]?\d+$/;

/**
 * Split text into tokens, keeping each token's span in the original string.
 * @param {string} text
 * @returns {Array<{ value: string, start: number, end: number, quoted: boolean }>}
 */
export function tokenize(text) {
  const tokens = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    while (i < n && /\s/.test(text[i])) i++;
    if (i >= n) break;
    const start = i;
    let value = '';
    let quoted = false;
    const quote = text[i] === '"' || text[i] === "'" || text[i] === '“' ? text[i] : null;
    if (quote) {
      const close = quote === '“' ? '”' : quote;
      i++;
      let closed = false;
      while (i < n) {
        if (text[i] === '\\' && i + 1 < n) {
          value += text[i + 1];
          i += 2;
          continue;
        }
        if (text[i] === close) {
          closed = true;
          i++;
          break;
        }
        value += text[i++];
      }
      if (closed && (i >= n || /\s/.test(text[i]))) {
        tokens.push({ value, start, end: i, quoted: true });
        continue;
      }
      // Unbalanced or glued quote: treat it as a plain word from the start.
      i = start;
      value = '';
      quoted = false;
    }
    while (i < n && !/\s/.test(text[i])) {
      if (text[i] === '\\' && i + 1 < n) {
        value += text[i + 1];
        i += 2;
        continue;
      }
      value += text[i++];
    }
    tokens.push({ value, start, end: i, quoted });
  }
  return tokens;
}

const isFreeText = (opt) => opt.type === OptionType.String && !opt.choices?.length && !opt.pattern;

/**
 * Match text to a choice by name or value (case-insensitive). A namespaced
 * value also matches by its last part, so `bf6` finds `battlefield:bf6`.
 */
function matchChoice(opt, raw) {
  const lower = raw.toLowerCase();
  return opt.choices.find((c) => {
    const value = String(c.value).toLowerCase();
    return value === lower || value.split(':').pop() === lower || String(c.name).toLowerCase() === lower;
  });
}

const MAX_CHOICE_WORDS = 4;

/**
 * How many unquoted tokens from `ti` spell one of `opt`'s choices, taking the
 * longest match ("Battlefield 6" over a lone "Battlefield"). Choice names have
 * spaces ("PlayStation 5", "Old School RuneScape") but tokens don't. Returns
 * 0 when nothing longer than one token matches — single tokens go through
 * accepts() as before.
 */
function choiceRun(opt, tokens, ti) {
  if (!opt.choices?.length) return 0;
  for (let k = Math.min(MAX_CHOICE_WORDS, tokens.length - ti); k > 1; k--) {
    const run = tokens.slice(ti, ti + k);
    if (run.some((t) => t.quoted)) continue;
    if (matchChoice(opt, run.map((t) => t.value).join(' '))) return k;
  }
  return 0;
}

const joinRun = (tokens, ti, k) =>
  tokens
    .slice(ti, ti + k)
    .map((t) => t.value)
    .join(' ');

/**
 * Does `raw` fit `opt`? `strict` is used for look-ahead and peeling, where only
 * unambiguous forms count (mentions / ids / #names, never a bare word).
 */
export function accepts(opt, raw, strict = false) {
  switch (opt.type) {
    case OptionType.Integer:
      if (opt.choices?.length) return Boolean(matchChoice(opt, raw));
      return INTEGER.test(raw);
    case OptionType.Boolean:
      return TRUE_WORDS.has(raw.toLowerCase()) || FALSE_WORDS.has(raw.toLowerCase());
    case OptionType.User:
      return USER_MENTION.test(raw) || SNOWFLAKE.test(raw) || (!strict && raw.length > 0);
    case OptionType.Role:
      return ROLE_MENTION.test(raw) || SNOWFLAKE.test(raw) || (!strict && raw.length > 0);
    case OptionType.Channel:
      return (
        CHANNEL_MENTION.test(raw) || SNOWFLAKE.test(raw) || /^#\S+$/.test(raw) || (!strict && raw.length > 0)
      );
    case OptionType.String:
      if (opt.choices?.length) return Boolean(matchChoice(opt, raw));
      if (opt.pattern) return opt.pattern.test(raw);
      return !strict;
    default:
      return false;
  }
}

/** Human-readable type label for errors and usage. */
export function typeLabel(opt) {
  switch (opt.type) {
    case OptionType.Integer:
      return 'a whole number';
    case OptionType.Boolean:
      return 'yes or no';
    case OptionType.User:
      return 'a member (@mention or id)';
    case OptionType.Role:
      return 'a role (@mention or id)';
    case OptionType.Channel:
      return 'a channel (#mention or id)';
    default:
      if (opt.choices?.length) return `one of: ${opt.choices.map((c) => c.name).join(', ')}`;
      return opt.patternHint ?? 'text';
  }
}

/**
 * Convert and validate one raw value for `opt`. Returns `{ value }` or `{ error }`.
 * User / channel / role come back as `{ ref }` (an id or a name) for resolve.js.
 */
export function coerce(opt, raw) {
  const name = opt.name;
  switch (opt.type) {
    case OptionType.Integer: {
      let n;
      if (opt.choices?.length) {
        const c = matchChoice(opt, raw);
        if (!c) return { error: `\`${name}\` must be ${typeLabel(opt)}.` };
        n = Number(c.value);
      } else {
        if (!INTEGER.test(raw)) return { error: `\`${name}\` must be a whole number.` };
        n = Number(raw);
      }
      if (opt.min_value !== undefined && n < opt.min_value)
        return { error: `\`${name}\` must be at least ${opt.min_value}.` };
      if (opt.max_value !== undefined && n > opt.max_value)
        return { error: `\`${name}\` must be at most ${opt.max_value}.` };
      return { value: n };
    }
    case OptionType.Boolean: {
      const w = raw.toLowerCase();
      if (TRUE_WORDS.has(w)) return { value: true };
      if (FALSE_WORDS.has(w)) return { value: false };
      return { error: `\`${name}\` must be yes or no.` };
    }
    case OptionType.User: {
      const m = USER_MENTION.exec(raw);
      if (m) return { value: { ref: m[1] } };
      return { value: { ref: raw.replace(/^@/, '') } };
    }
    case OptionType.Role: {
      const m = ROLE_MENTION.exec(raw);
      if (m) return { value: { ref: m[1] } };
      return { value: { ref: raw.replace(/^@/, '') } };
    }
    case OptionType.Channel: {
      const m = CHANNEL_MENTION.exec(raw);
      if (m) return { value: { ref: m[1] } };
      return { value: { ref: raw.replace(/^#/, '') } };
    }
    default: {
      let value = raw;
      if (opt.choices?.length) {
        const c = matchChoice(opt, raw);
        if (!c) return { error: `\`${name}\` must be ${typeLabel(opt)}.` };
        value = c.value;
      } else if (opt.pattern && !opt.pattern.test(raw)) {
        return { error: `\`${name}\` must be ${typeLabel(opt)}.` };
      }
      if (opt.min_length !== undefined && value.length < opt.min_length)
        return { error: `\`${name}\` must be at least ${opt.min_length} characters.` };
      if (opt.max_length !== undefined && value.length > opt.max_length)
        return { error: `\`${name}\` must be at most ${opt.max_length} characters.` };
      return { value };
    }
  }
}

/**
 * Parse the argument text of a command.
 * @param {string} text  everything after the command name
 * @param {{ options: object[] }} schema  the command builder (not its JSON — patterns live on the builder)
 * @returns {{ sub: string | null, values: Map<string, any>, errors: string[] }}
 */
export function parseArgs(text, schema) {
  const errors = [];
  const values = new Map();
  let tokens = tokenize(text);

  // 2. Subcommand.
  let sub = null;
  let options = schema.options ?? [];
  const subs = options.filter((o) => o.type === OptionType.Subcommand);
  if (subs.length) {
    const first = tokens[0]?.value.toLowerCase();
    const picked = subs.find((s) => s.name === first);
    if (!picked) {
      errors.push(
        first
          ? `Unknown subcommand \`${tokens[0].value}\`. Use one of: ${subs.map((s) => `\`${s.name}\``).join(', ')}.`
          : `Pick a subcommand: ${subs.map((s) => `\`${s.name}\``).join(', ')}.`
      );
      return { sub: null, values, errors };
    }
    sub = picked.name;
    options = picked.options ?? [];
    tokens = tokens.slice(1);
  }
  const byName = new Map(options.map((o) => [o.name, o]));

  const set = (opt, raw) => {
    const res = coerce(opt, raw);
    if (res.error) errors.push(res.error);
    else values.set(opt.name, res.value);
  };

  // 3. name:value tokens.
  tokens = tokens.filter((t) => {
    if (t.quoted) return true;
    const m = /^([a-z0-9_-]+):(.*)$/s.exec(t.value);
    if (!m || !byName.has(m[1].toLowerCase()) || m[2].startsWith('//')) return true;
    let raw = m[2];
    if (/^["'].*["']$/s.test(raw) && raw.length >= 2) raw = raw.slice(1, -1);
    set(byName.get(m[1].toLowerCase()), raw);
    return false;
  });

  // 4/5. Positional.
  const pending = () => options.filter((o) => !values.has(o.name));
  const lastFree = [...options].reverse().find((o) => isFreeText(o) && !values.has(o.name)) ?? null;
  let cursor = 0; // index into `options`

  for (let ti = 0; ti < tokens.length; ti++) {
    const tok = tokens[ti];
    // Advance the cursor to the next unfilled option.
    while (cursor < options.length && values.has(options[cursor].name)) cursor++;
    const opt = options[cursor];
    if (!opt) {
      errors.push(`Unexpected extra argument \`${tok.value}\`.`);
      break;
    }

    if (isFreeText(opt)) {
      // Look ahead: a later typed option this token (or a multi-word choice
      // starting here) clearly fits takes it.
      const later = options
        .slice(cursor + 1)
        .find(
          (o) =>
            !values.has(o.name) &&
            !isFreeText(o) &&
            (accepts(o, tok.value, true) || choiceRun(o, tokens, ti) > 1)
        );
      if (later && !tok.quoted) {
        const run = choiceRun(later, tokens, ti);
        if (run > 1) {
          set(later, joinRun(tokens, ti, run));
          ti += run - 1;
        } else set(later, tok.value);
        continue;
      }
      if (opt === lastFree) {
        // Swallow the rest, peeling trailing tokens (or a trailing multi-word
        // choice) that fit later typed options.
        let rest = tokens.slice(ti);
        const after = options.slice(cursor + 1).filter((o) => !isFreeText(o));
        while (rest.length > 1) {
          let peeled = 0;
          for (let k = Math.min(MAX_CHOICE_WORDS, rest.length - 1); k >= 1 && !peeled; k--) {
            const tail = rest.slice(-k);
            if (tail.some((t) => t.quoted)) continue;
            const raw = tail.map((t) => t.value).join(' ');
            const fit = after.find(
              (o) =>
                !values.has(o.name) &&
                (k > 1 ? o.choices?.length && matchChoice(o, raw) : accepts(o, raw, true))
            );
            if (fit) {
              set(fit, raw);
              peeled = k;
            }
          }
          if (!peeled) break;
          rest = rest.slice(0, -peeled);
        }
        const raw =
          rest.length === 1 && rest[0].quoted
            ? rest[0].value
            : text.slice(rest[0].start, rest[rest.length - 1].end);
        set(opt, raw);
        break;
      }
      set(opt, tok.value);
      cursor++;
      continue;
    }

    // Typed option at the cursor — a multi-word choice first, then one token.
    const run = choiceRun(opt, tokens, ti);
    if (run > 1) {
      set(opt, joinRun(tokens, ti, run));
      ti += run - 1;
      cursor++;
      continue;
    }
    if (accepts(opt, tok.value, false)) {
      set(opt, tok.value);
      cursor++;
      continue;
    }
    if (!opt.required) {
      cursor++;
      ti--; // retry this token against the next option
      continue;
    }
    errors.push(`\`${opt.name}\` must be ${typeLabel(opt)} (got \`${tok.value}\`).`);
    break;
  }

  if (!errors.length) {
    for (const o of pending()) {
      if (o.required) errors.push(`Missing \`${o.name}\` — ${o.description || typeLabel(o)}.`);
    }
  }
  return { sub, values, errors };
}
