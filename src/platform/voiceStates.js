// Voice-state tracking. The Fluxer SDK passes raw VOICE_STATE_UPDATE payloads
// through and keeps no per-guild voice state, but temp-voice, leveling and
// insights need "who is in which voice channel" plus a before/after pair on each
// change. This keeps that map, seeded from each guild's initial voice_states
// (VoiceStatesSync) and updated from VoiceStateUpdate.
import { Events } from '@fluxerjs/core';
import { Collection } from '@fluxerjs/collection';

export class VoiceState {
  /**
   * @param {import('@fluxerjs/core').Client} client
   * @param {string} guildId
   * @param {object} data  raw APIVoiceState (snake_case)
   */
  constructor(client, guildId, data) {
    Object.defineProperty(this, 'client', { value: client, enumerable: false });
    this.guildId = guildId;
    this.id = data.user_id;
    this.channelId = data.channel_id ?? null;
    this.mute = Boolean(data.mute);
    this.deaf = Boolean(data.deaf);
    this.selfMute = Boolean(data.self_mute);
    this.selfDeaf = Boolean(data.self_deaf);
    this.selfVideo = Boolean(data.self_video);
    this.streaming = Boolean(data.self_stream);
    this.serverMute = this.mute;
    this.serverDeaf = this.deaf;
  }

  get guild() {
    return this.client.guilds.get(this.guildId) ?? null;
  }

  get member() {
    return this.guild?.members.get(this.id) ?? null;
  }

  get channel() {
    return this.channelId ? (this.guild?.channels.get(this.channelId) ?? null) : null;
  }
}

/** guildId -> Collection<userId, VoiceState> (only members currently connected). */
const byGuild = new Map();

/** @param {string} guildId */
export function voiceStatesFor(guildId) {
  let states = byGuild.get(guildId);
  if (!states) {
    states = new Collection();
    byGuild.set(guildId, states);
  }
  return states;
}

/** Members currently connected to `channelId` in `guildId`, keyed by user id. */
export function membersInVoiceChannel(guildId, channelId) {
  const out = new Collection();
  for (const state of voiceStatesFor(guildId).values()) {
    if (state.channelId !== channelId) continue;
    const member = state.member;
    if (member) out.set(state.id, member);
  }
  return out;
}

/** Forget everything about a guild (bot removed / guild unavailable). */
export function clearGuildVoiceStates(guildId) {
  byGuild.delete(guildId);
}

/**
 * Apply one raw voice-state payload and return the (old, new) pair. Exported
 * for tests.
 */
export function applyVoiceState(client, data) {
  const guildId = data.guild_id;
  if (!guildId || !data.user_id) return null;
  const states = voiceStatesFor(guildId);
  const old =
    states.get(data.user_id) ?? new VoiceState(client, guildId, { user_id: data.user_id, channel_id: null });
  const next = new VoiceState(client, guildId, data);
  if (next.channelId) states.set(next.id, next);
  else states.delete(next.id);
  return { old, new: next };
}

/**
 * Start tracking. `onUpdate(oldState, newState)` fires for every change after
 * the initial sync — the discord.js `voiceStateUpdate` contract.
 * @param {import('@fluxerjs/core').Client} client
 * @param {(oldState: VoiceState, newState: VoiceState) => void} onUpdate
 */
export function trackVoiceStates(client, onUpdate) {
  client.on(Events.VoiceStatesSync, ({ guildId, voiceStates }) => {
    const states = voiceStatesFor(guildId);
    states.clear();
    for (const raw of voiceStates ?? []) {
      const state = new VoiceState(client, guildId, raw);
      if (state.channelId) states.set(state.id, state);
    }
  });
  client.on(Events.VoiceStateUpdate, (data) => {
    // Keep the member cache fresh when the payload carries one.
    const guild = data.guild_id ? client.guilds.get(data.guild_id) : null;
    if (guild && data.member && !guild.members.get(data.user_id)) {
      guild.members.fetch(data.user_id).catch(() => {});
    }
    const pair = applyVoiceState(client, data);
    if (pair) onUpdate(pair.old, pair.new);
  });
  client.on(Events.GuildDelete, (guild) => clearGuildVoiceStates(guild?.id ?? guild));
}
