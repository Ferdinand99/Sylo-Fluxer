// The one place Sylo imports platform (Fluxer SDK) building blocks from.
// Importing this module also installs the discord.js-shaped compatibility
// aliases (see ./compat.js), so it must be loaded before any SDK object is used —
// src/bot/index.js imports it first.
import { MessageFlags as FluxerMessageFlags, AuditLogActionType } from '@fluxerjs/core';
import { installCompat } from './compat.js';

installCompat();

export { Client, Events, EmbedBuilder, AttachmentBuilder } from '@fluxerjs/core';
export { Collection } from '@fluxerjs/collection';
export {
  ChannelType,
  TEXT_CHANNEL_TYPES,
  VOICE_CHANNEL_TYPES,
  isTextChannel,
  isVoiceChannel,
} from './channelTypes.js';
export { PermissionFlagsBits, PermissionsBitField, permissionNames } from './permissions.js';
export { time, ts } from './time.js';
export { isSnowflake, SNOWFLAKE_RE } from './snowflake.js';
export {
  userMention,
  roleMention,
  channelMention,
  parseUserId,
  parseRoleId,
  parseChannelId,
} from './mentions.js';

/**
 * Message flags. Fluxer has no ephemeral messages; `Ephemeral` (discord.js's
 * 1<<6) is kept as a marker the prefix-command adapter reads to decide how to
 * deliver a "private" reply (auto-delete or DM). It is stripped before sending.
 */
export const MessageFlags = Object.freeze({ ...FluxerMessageFlags, Ephemeral: 1 << 6 });

/** Audit-log action types (discord.js name). */
export const AuditLogEvent = AuditLogActionType;

/** Presence activity types (same numbering as the gateway uses). */
export const ActivityType = Object.freeze({
  Playing: 0,
  Streaming: 1,
  Listening: 2,
  Watching: 3,
  Custom: 4,
  Competing: 5,
});
