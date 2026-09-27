// Channel types Sylo understands, mapped to Fluxer's values. Fluxer has text,
// voice, category and link channels (plus DMs); it has no announcement, stage,
// forum or thread channels, so those names are deliberately absent — code that
// needs them must not exist in this port.
import { ChannelType as FluxerChannelType } from '@fluxerjs/core';

export const ChannelType = Object.freeze({
  GuildText: FluxerChannelType.GuildText,
  DM: FluxerChannelType.DM,
  GuildVoice: FluxerChannelType.GuildVoice,
  GroupDM: FluxerChannelType.GroupDM,
  GuildCategory: FluxerChannelType.GuildCategory,
  GuildLink: FluxerChannelType.GuildLink,
});

/** Channel types members can post messages in (what "text channel" pickers offer). */
export const TEXT_CHANNEL_TYPES = Object.freeze([ChannelType.GuildText]);

/** Voice channel types (temp-voice hubs, server-stats counters). */
export const VOICE_CHANNEL_TYPES = Object.freeze([ChannelType.GuildVoice]);

/** @param {{ type?: number } | null | undefined} channel */
export const isTextChannel = (channel) => channel?.type === ChannelType.GuildText;

/** @param {{ type?: number } | null | undefined} channel */
export const isVoiceChannel = (channel) => channel?.type === ChannelType.GuildVoice;
