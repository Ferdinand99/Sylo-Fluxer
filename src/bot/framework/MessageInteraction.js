// A prefix-command invocation shaped like a discord.js ChatInputCommandInteraction,
// so command modules written for slash commands run unchanged.
//
// Reply model:
//   - reply()/editReply() send (then edit) one reply message; followUp() sends another.
//   - deferReply() just shows the typing indicator; the first editReply() sends.
//   - "Ephemeral" (flags: MessageFlags.Ephemeral or ephemeral: true) has no
//     Fluxer equivalent. The command's `privateReplies` mode decides:
//       'auto' — reply in the channel, then delete the reply and the invoking
//                message after PRIVATE_TTL_MS;
//       'dm'   — send the reply by DM and react ✅ on the invoking message
//                (falls back to 'auto' when the member's DMs are closed).
import { log } from '../../lib/log.js';

export const PRIVATE_TTL_MS = 15_000;
const EPHEMERAL = 1 << 6;

/** Split a discord.js-style reply payload into a Fluxer send payload + intent. */
export function normalisePayload(input) {
  const p = typeof input === 'string' ? { content: input } : { ...(input ?? {}) };
  let ephemeral = Boolean(p.ephemeral);
  if (typeof p.flags === 'number' && (p.flags & EPHEMERAL) === EPHEMERAL) ephemeral = true;
  const wantsResponse = Boolean(p.withResponse || p.fetchReply);
  delete p.ephemeral;
  delete p.flags;
  delete p.withResponse;
  delete p.fetchReply;
  delete p.components; // buttons / selects don't exist on Fluxer
  if (p.content === '') delete p.content;
  return { payload: p, ephemeral, wantsResponse };
}

class Options {
  /** @param {MessageInteraction} ix */
  constructor(ix, sub, resolved) {
    this._ix = ix;
    this._sub = sub;
    this._resolved = resolved;
  }

  _get(name, required) {
    const entry = this._resolved.get(name);
    if (!entry && required) throw new TypeError(`Required option "${name}" not found.`);
    return entry ?? null;
  }

  getSubcommand(required = true) {
    if (!this._sub && required) throw new TypeError('No subcommand specified.');
    return this._sub;
  }

  getSubcommandGroup() {
    return null;
  }

  getString(name, required = false) {
    return this._get(name, required)?.value ?? null;
  }

  getInteger(name, required = false) {
    return this._get(name, required)?.value ?? null;
  }

  getNumber(name, required = false) {
    return this._get(name, required)?.value ?? null;
  }

  getBoolean(name, required = false) {
    return this._get(name, required)?.value ?? null;
  }

  getUser(name, required = false) {
    return this._get(name, required)?.user ?? null;
  }

  getMember(name) {
    return this._resolved.get(name)?.member ?? null;
  }

  getChannel(name, required = false) {
    return this._get(name, required)?.channel ?? null;
  }

  getRole(name, required = false) {
    return this._get(name, required)?.role ?? null;
  }

  getMentionable(name, required = false) {
    const e = this._get(name, required);
    return e?.member ?? e?.user ?? e?.role ?? null;
  }
}

export class MessageInteraction {
  /**
   * @param {object} init
   * @param {import('@fluxerjs/core').Message} init.message  the invoking message
   * @param {string} init.commandName
   * @param {string | null} [init.sub]
   * @param {Map<string, any>} [init.resolved]  from resolveValues()
   * @param {'auto' | 'dm'} [init.privateReplies]
   * @param {import('@fluxerjs/core').GuildMember | null} [init.member]
   */
  constructor({
    message,
    commandName,
    sub = null,
    resolved = new Map(),
    privateReplies = 'auto',
    member = null,
  }) {
    this.message = message;
    this.id = message.id;
    this.commandName = commandName;
    this.client = message.client;
    this.user = message.author;
    this.member = member ?? message.member ?? null;
    this.guildId = message.guildId ?? null;
    this.channelId = message.channelId;
    this.createdTimestamp = message.createdAt?.getTime?.() ?? Date.now();
    this.options = new Options(this, sub, resolved);
    this.privateReplies = privateReplies;
    this.deferred = false;
    this.replied = false;
    this.ephemeral = null;
    /** @type {import('@fluxerjs/core').Message | null} */
    this._reply = null;
    this._replyPrivate = false;
    this._deleteTimer = null;
  }

  /** Attach the parsed + resolved arguments (the router does this after its checks). */
  setArguments(sub, resolved) {
    this.options = new Options(this, sub, resolved);
  }

  get guild() {
    return this.message.guild ?? null;
  }

  get channel() {
    return this.message.channel ?? null;
  }

  get memberPermissions() {
    const channel = this.channel;
    if (!this.member || !channel?.guildId) return null;
    return this.member.permissionsIn(channel);
  }

  get locale() {
    return 'en-US';
  }

  inGuild() {
    return Boolean(this.guildId);
  }

  inCachedGuild() {
    return Boolean(this.guild);
  }

  isChatInputCommand() {
    return true;
  }

  isCommand() {
    return true;
  }

  isRepliable() {
    return true;
  }

  isMessageComponent() {
    return false;
  }

  isButton() {
    return false;
  }

  isStringSelectMenu() {
    return false;
  }

  isAutocomplete() {
    return false;
  }

  // --- delivery ---------------------------------------------------------------

  _schedulePrivateCleanup(sent) {
    clearTimeout(this._deleteTimer);
    this._deleteTimer = setTimeout(() => {
      sent?.delete().catch(() => {});
      this.message.delete().catch(() => {});
    }, PRIVATE_TTL_MS);
    this._deleteTimer.unref?.();
  }

  /** Send a new message according to the private/public intent. */
  async _send(payload, ephemeral) {
    if (ephemeral && this.privateReplies === 'dm') {
      try {
        const sent = await this.user.send(payload);
        this.message.react('✅').catch(() => {});
        return { sent, private: true };
      } catch (err) {
        log.debug('commands', `DM to ${this.user.id} failed, replying in channel:`, err?.message);
      }
    }
    const sent = await this.message.reply({ ...payload, ping: false });
    if (ephemeral) this._schedulePrivateCleanup(sent);
    return { sent, private: ephemeral };
  }

  _result(message, wantsResponse) {
    return wantsResponse ? { resource: { message }, message } : message;
  }

  async reply(input) {
    if (this.replied || this.deferred)
      throw new Error('The reply to this command has already been sent or deferred.');
    const { payload, ephemeral, wantsResponse } = normalisePayload(input);
    this.ephemeral = ephemeral;
    const { sent } = await this._send(payload, ephemeral);
    this._reply = sent;
    this.replied = true;
    return this._result(sent, wantsResponse);
  }

  async deferReply(opts = {}) {
    if (this.replied || this.deferred)
      throw new Error('The reply to this command has already been sent or deferred.');
    const { ephemeral, wantsResponse } = normalisePayload(opts);
    this.ephemeral = ephemeral;
    this.deferred = true;
    this.channel?.sendTyping?.().catch(() => {});
    return wantsResponse ? { resource: { message: null } } : undefined;
  }

  async editReply(input) {
    const { payload } = normalisePayload(input);
    if (!this._reply) {
      const { sent } = await this._send(payload, Boolean(this.ephemeral));
      this._reply = sent;
      this.replied = true;
      return sent;
    }
    this._reply = await this._reply.edit(payload);
    if (this.ephemeral && this.privateReplies !== 'dm') this._schedulePrivateCleanup(this._reply);
    return this._reply;
  }

  async followUp(input) {
    const { payload, ephemeral } = normalisePayload(input);
    const { sent } = await this._send(payload, ephemeral);
    if (!this._reply) {
      this._reply = sent;
      this.replied = true;
    }
    return sent;
  }

  async fetchReply() {
    return this._reply;
  }

  async deleteReply() {
    await this._reply?.delete().catch(() => {});
    this._reply = null;
  }
}
