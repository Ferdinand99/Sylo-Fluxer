// Guild channel helpers. Fluxer's `guild.channels` is a plain cache collection:
// it has no fetch/create, and its `delete(id)` only evicts from the cache (it
// does NOT delete the channel). Always go through these instead.
import { OverwriteType, PermissionsBitField } from '@fluxerjs/core';

const idOf = (x) => (typeof x === 'string' ? x : x?.id);

/**
 * A guild's channel from cache, or fetched; null if missing or in another guild.
 * @param {import('@fluxerjs/core').Guild} guild
 * @param {string} channelId
 */
export async function fetchGuildChannel(guild, channelId) {
  if (!guild || !channelId) return null;
  const cached = guild.channels.get(channelId);
  if (cached) return cached;
  const ch = await guild.client.channels.fetch(channelId).catch(() => null);
  return ch && ch.guildId === guild.id ? ch : null;
}

/** Delete a channel by id (no-op if it's already gone). */
export async function deleteGuildChannel(guild, channelId) {
  const ch = await fetchGuildChannel(guild, channelId);
  if (ch) await ch.delete();
}

/** discord.js overwrite entry → Fluxer `{ id, type, allow, deny }`. */
function toOverwrite(guild, o) {
  const id = idOf(o.id);
  const isRole = id === guild.id || Boolean(guild.roles.get(id));
  return {
    id,
    type: o.type ?? (isRole ? OverwriteType.Role : OverwriteType.Member),
    allow: new PermissionsBitField(o.allow ?? 0n).bitfield,
    deny: new PermissionsBitField(o.deny ?? 0n).bitfield,
  };
}

/**
 * Create a channel from discord.js-style options
 * (`{ name, type, parent, permissionOverwrites, userLimit, topic, reason }`).
 * @param {import('@fluxerjs/core').Guild} guild
 * @param {object} opts
 */
export async function createGuildChannel(guild, opts) {
  const { name, type, parent, topic, userLimit, bitrate, rateLimitPerUser, nsfw } = opts;
  return guild.createChannel({
    name,
    type,
    parentId: idOf(parent) ?? opts.parentId ?? null,
    topic,
    userLimit,
    bitrate,
    rateLimitPerUser,
    nsfw,
    permissionOverwrites: (opts.permissionOverwrites ?? []).map((o) => toOverwrite(guild, o)),
  });
}
