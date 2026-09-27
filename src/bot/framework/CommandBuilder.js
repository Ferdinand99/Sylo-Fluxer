// Command definitions for prefix commands.
//
// Fluxer has no slash commands, but a command's shape — name, options, types,
// choices, ranges, default permissions — is still the right way to describe it:
// the prefix parser, the usage/help text and the dashboard's command list are
// all generated from it. This builder mirrors the subset of discord.js's
// SlashCommandBuilder that Sylo's commands use, so each command file keeps its
// `data` definition, and `toJSON()` keeps discord.js's JSON shape (option type
// numbers, `default_member_permissions` as a string) so the dashboard code that
// reads it is unchanged.

/** Option type numbers (discord.js ApplicationCommandOptionType values). */
export const OptionType = Object.freeze({
  Subcommand: 1,
  SubcommandGroup: 2,
  String: 3,
  Integer: 4,
  Boolean: 5,
  User: 6,
  Channel: 7,
  Role: 8,
});

/** Where a command may run (discord.js InteractionContextType values). */
export const InteractionContextType = Object.freeze({ Guild: 0, BotDM: 1, PrivateChannel: 2 });

const NAME_RE = /^[a-z0-9_-]{1,32}$/;

class Named {
  constructor() {
    this.name = undefined;
    this.description = '';
  }

  setName(name) {
    if (!NAME_RE.test(name)) throw new TypeError(`Invalid command/option name: ${name}`);
    this.name = name;
    return this;
  }

  setDescription(description) {
    this.description = description;
    return this;
  }
}

export class OptionBuilder extends Named {
  /** @param {number} type */
  constructor(type) {
    super();
    this.type = type;
    this.required = false;
    this.choices = undefined;
    this.min_value = undefined;
    this.max_value = undefined;
    this.min_length = undefined;
    this.max_length = undefined;
    this.channel_types = undefined;
  }

  setRequired(required = true) {
    this.required = Boolean(required);
    return this;
  }

  setMinValue(n) {
    this.min_value = n;
    return this;
  }

  setMaxValue(n) {
    this.max_value = n;
    return this;
  }

  setMinLength(n) {
    this.min_length = n;
    return this;
  }

  setMaxLength(n) {
    this.max_length = n;
    return this;
  }

  /** @param {...{ name: string, value: string | number }} choices */
  addChoices(...choices) {
    this.choices = [...(this.choices ?? []), ...choices.flat()];
    return this;
  }

  /**
   * Framework-only: the shape a string must have (e.g. a duration). Lets the
   * prefix parser recognise it out of order; not part of toJSON().
   * @param {RegExp} pattern
   * @param {string} hint  how to describe it in errors, e.g. 'a duration like 10m or 1d'
   */
  setPattern(pattern, hint) {
    Object.defineProperty(this, 'pattern', { value: pattern, enumerable: false, writable: true });
    Object.defineProperty(this, 'patternHint', { value: hint, enumerable: false, writable: true });
    return this;
  }

  /** @param {...number} types */
  addChannelTypes(...types) {
    this.channel_types = [...(this.channel_types ?? []), ...types.flat()];
    return this;
  }

  toJSON() {
    const out = { type: this.type, name: this.name, description: this.description, required: this.required };
    for (const key of ['choices', 'min_value', 'max_value', 'min_length', 'max_length', 'channel_types']) {
      if (this[key] !== undefined) out[key] = this[key];
    }
    return out;
  }
}

/** Shared add*Option methods for commands and subcommands. */
class OptionHost extends Named {
  constructor() {
    super();
    this.options = [];
  }

  _add(type, fn) {
    const opt = fn(new OptionBuilder(type));
    this.options.push(opt);
    return this;
  }

  addStringOption(fn) {
    return this._add(OptionType.String, fn);
  }

  addIntegerOption(fn) {
    return this._add(OptionType.Integer, fn);
  }

  addBooleanOption(fn) {
    return this._add(OptionType.Boolean, fn);
  }

  addUserOption(fn) {
    return this._add(OptionType.User, fn);
  }

  addChannelOption(fn) {
    return this._add(OptionType.Channel, fn);
  }

  addRoleOption(fn) {
    return this._add(OptionType.Role, fn);
  }
}

export class SubcommandBuilder extends OptionHost {
  constructor() {
    super();
    this.type = OptionType.Subcommand;
  }

  toJSON() {
    return {
      type: OptionType.Subcommand,
      name: this.name,
      description: this.description,
      options: this.options.map((o) => o.toJSON()),
    };
  }
}

export class CommandBuilder extends OptionHost {
  constructor() {
    super();
    this.default_member_permissions = undefined;
    this.contexts = undefined;
    this.aliases = [];
    this.examples = [];
    /** How replies marked ephemeral are delivered: 'auto' (auto-delete) or 'dm'. */
    this.privateReplies = 'auto';
  }

  /** @param {bigint | string | number | null} permissions */
  setDefaultMemberPermissions(permissions) {
    this.default_member_permissions = permissions == null ? undefined : String(BigInt(permissions));
    return this;
  }

  /** @param {...number} contexts */
  setContexts(...contexts) {
    this.contexts = contexts.flat();
    return this;
  }

  /** Legacy discord.js API; `false` means guild-only. */
  setDMPermission(allowed) {
    if (allowed === false) this.contexts = [InteractionContextType.Guild];
    return this;
  }

  /** @param {string[]} aliases  extra names the command answers to */
  setAliases(aliases) {
    for (const a of aliases) if (!NAME_RE.test(a)) throw new TypeError(`Invalid alias: ${a}`);
    this.aliases = [...aliases];
    return this;
  }

  /** @param {string[]} examples  argument strings shown in help, e.g. ['@user spamming'] */
  setExamples(examples) {
    this.examples = [...examples];
    return this;
  }

  /** @param {'auto' | 'dm'} mode */
  setPrivateReplies(mode) {
    if (!['auto', 'dm'].includes(mode)) throw new TypeError(`Invalid private reply mode: ${mode}`);
    this.privateReplies = mode;
    return this;
  }

  /** @param {(s: SubcommandBuilder) => SubcommandBuilder} fn */
  addSubcommand(fn) {
    this.options.push(fn(new SubcommandBuilder()));
    return this;
  }

  /** Only runs in a guild (not in DMs). */
  get guildOnly() {
    return Array.isArray(this.contexts) && !this.contexts.includes(InteractionContextType.BotDM);
  }

  toJSON() {
    const out = {
      name: this.name,
      description: this.description,
      options: this.options.map((o) => o.toJSON()),
    };
    if (this.default_member_permissions !== undefined) {
      out.default_member_permissions = this.default_member_permissions;
    }
    if (this.contexts !== undefined) out.contexts = this.contexts;
    if (this.aliases.length) out.aliases = this.aliases;
    if (this.examples.length) out.examples = this.examples;
    return out;
  }
}

/** discord.js name, so command files only change their import path. */
export { CommandBuilder as SlashCommandBuilder };

/** Pattern for duration options ("10m", "1h30m", "2d") — see src/bot/lib/duration.js. */
export const DURATION = [/^(\d+[wdhms])+$/i, 'a duration like 10m, 2h or 1d'];
/** Pattern for raw id options (e.g. /unban user_id, where the user isn't a member). */
export const USER_ID = [/^(<@!?)?\d{17,20}>?$/, 'a user id'];
