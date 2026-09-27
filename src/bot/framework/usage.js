// Usage strings generated from a command's schema, e.g.
//   !warn add <user> <reason…>
//   !ban <user> [duration] [delete_messages] [reason…]
import { OptionType } from './CommandBuilder.js';

const isFreeText = (o) => o.type === OptionType.String && !o.choices?.length && !o.pattern;

/** One option as `<name>` / `[name]`, with `…` on the text that takes the rest. */
function optionToken(opt, isLastFree) {
  const label = `${opt.name}${isLastFree ? '…' : ''}`;
  return opt.required ? `<${label}>` : `[${label}]`;
}

/**
 * Order options the way they're easiest to type: required first, typed
 * before free text, and the rest-of-line text last — which is also an order
 * the parser always accepts.
 */
function typingOrder(options) {
  const lastFree = [...options].reverse().find(isFreeText) ?? null;
  const rank = (o) => (o === lastFree ? 3 : isFreeText(o) ? (o.required ? 0 : 2) : o.required ? 0 : 1);
  return { ordered: [...options].sort((a, b) => rank(a) - rank(b)), lastFree };
}

/**
 * @param {string} prefix
 * @param {string} name  command name
 * @param {object[]} options  option builders (or their JSON) of the command/subcommand
 * @param {string | null} [sub]
 */
export function usageLine(prefix, name, options, sub = null) {
  const { ordered, lastFree } = typingOrder(options ?? []);
  const parts = [`${prefix}${name}`];
  if (sub) parts.push(sub);
  for (const o of ordered) parts.push(optionToken(o, o === lastFree));
  return parts.join(' ');
}

/** Describe one option for detailed help: `user — Member to warn (a member)`. */
export function optionHelp(opt) {
  const bits = [];
  if (opt.choices?.length) bits.push(`one of: ${opt.choices.map((c) => c.name).join(', ')}`);
  if (opt.min_value !== undefined || opt.max_value !== undefined) {
    bits.push(`${opt.min_value ?? '…'}–${opt.max_value ?? '…'}`);
  }
  if (opt.patternHint) bits.push(opt.patternHint);
  const extra = bits.length ? ` (${bits.join('; ')})` : '';
  return `\`${opt.name}\`${opt.required ? '' : ' (optional)'} — ${opt.description || ''}${extra}`;
}

/**
 * Every usage line for a command builder (one per subcommand).
 * @param {string} prefix
 * @param {import('./CommandBuilder.js').CommandBuilder} data
 * @returns {Array<{ sub: string | null, line: string, description: string, options: object[] }>}
 */
export function usageLines(prefix, data) {
  const subs = data.options.filter((o) => o.type === OptionType.Subcommand);
  if (!subs.length) {
    return [
      {
        sub: null,
        line: usageLine(prefix, data.name, data.options),
        description: data.description,
        options: data.options,
      },
    ];
  }
  return subs.map((s) => ({
    sub: s.name,
    line: usageLine(prefix, data.name, s.options, s.name),
    description: s.description,
    options: s.options,
  }));
}
