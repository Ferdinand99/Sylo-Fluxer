// Per-guild settings: mod-log channel, dashboard "bot master" roles, a
// default embed colour and the command prefix.
import { prepare, registerPostgresBootstrap, registerPostgresMigration } from './driver.js';

export const DEFAULT_EMBED_COLOR = 0x7aa2f7; // Sylo brand blue

// Column set reflects the CREATE TABLE migration plus three later
// ALTER TABLE migrations (modlog_channel_id, bot_master_roles, embed_color)
// — confirmed by grepping every `ALTER TABLE guild_settings` in MIGRATIONS,
// not just the original CREATE TABLE.
registerPostgresBootstrap(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id          TEXT PRIMARY KEY,
    default_title     TEXT,
    updated_at        BIGINT NOT NULL,
    modlog_channel_id TEXT,
    bot_master_roles  TEXT NOT NULL DEFAULT '[]',
    embed_color       INTEGER,
    prefix            TEXT
  );
`);
// Mirrors SQLite migration 45 for Postgres databases bootstrapped before it.
registerPostgresMigration(45, 'ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS prefix TEXT;');

/** Prefix used when a guild hasn't set its own. */
export const DEFAULT_PREFIX = '!';

const selectStmt = prepare('SELECT * FROM guild_settings WHERE guild_id = ?');
const deleteStmt = prepare('DELETE FROM guild_settings WHERE guild_id = ?');
const ensureStmt = prepare(
  'INSERT INTO guild_settings (guild_id, updated_at) VALUES (?, ?) ON CONFLICT (guild_id) DO NOTHING'
);
const setCol = {
  modlog_channel_id: prepare(
    'UPDATE guild_settings SET modlog_channel_id = @v, updated_at = @t WHERE guild_id = @g'
  ),
  bot_master_roles: prepare(
    'UPDATE guild_settings SET bot_master_roles = @v, updated_at = @t WHERE guild_id = @g'
  ),
  embed_color: prepare('UPDATE guild_settings SET embed_color = @v, updated_at = @t WHERE guild_id = @g'),
  prefix: prepare('UPDATE guild_settings SET prefix = @v, updated_at = @t WHERE guild_id = @g'),
};

/**
 * @param {string} guildId
 * @returns {Promise<{ guild_id: string, modlog_channel_id: string|null, bot_master_roles: string,
 *   embed_color: number|null, updated_at: number } | undefined>}
 */
export async function getGuildSettings(guildId) {
  return selectStmt.get(guildId);
}

async function put(guildId, col, value) {
  await ensureStmt.run(guildId, Date.now());
  await setCol[col].run({ g: guildId, v: value, t: Date.now() });
}

/** Set (or clear, with null) the mod-log channel for a guild. */
export async function setModlogChannel(guildId, channelId) {
  await put(guildId, 'modlog_channel_id', channelId);
}

/** Roles (besides Discord admins) allowed to manage this guild in the dashboard. */
export async function getBotMasterRoles(guildId) {
  try {
    const v = JSON.parse((await getGuildSettings(guildId))?.bot_master_roles ?? '[]');
    return Array.isArray(v) ? v.filter((r) => /^\d{17,20}$/.test(r)) : [];
  } catch {
    return [];
  }
}
export async function setBotMasterRoles(guildId, roleIds) {
  const clean = [
    ...new Set((Array.isArray(roleIds) ? roleIds : []).filter((r) => /^\d{17,20}$/.test(r))),
  ].slice(0, 25);
  await put(guildId, 'bot_master_roles', JSON.stringify(clean));
  return clean;
}

/** Raw stored embed colour (integer) or null. */
export async function setEmbedColor(guildId, colorInt) {
  await put(guildId, 'embed_color', Number.isInteger(colorInt) ? colorInt : null);
}
/** Effective embed colour for a guild — stored value, else the Sylo default. */
export async function guildEmbedColor(guildId) {
  const c = (await getGuildSettings(guildId))?.embed_color;
  return Number.isInteger(c) ? c : DEFAULT_EMBED_COLOR;
}

/** Remove all settings for a guild (used when Sylo leaves it). */
export async function deleteGuildSettings(guildId) {
  prefixCache.delete(guildId);
  await deleteStmt.run(guildId);
}

// --- command prefix ----------------------------------------------------------

const PREFIX_TTL_MS = 60_000;
/** guildId -> { prefix, at } — the prefix is read on every message. */
const prefixCache = new Map();

/**
 * Validate a prefix: 1–5 characters, no whitespace, and not something that
 * would collide with mentions / markdown. Returns an error message or null.
 * @param {string} prefix
 */
export function prefixError(prefix) {
  if (typeof prefix !== 'string' || prefix.length < 1 || prefix.length > 5) {
    return 'The prefix must be 1–5 characters.';
  }
  if (/\s/.test(prefix)) return 'The prefix cannot contain spaces.';
  if (/^[<@#]/.test(prefix) || /[`*_~|>]/.test(prefix)) {
    return 'The prefix cannot start with < @ # or contain markdown characters (` * _ ~ | >).';
  }
  return null;
}

/** The command prefix for a guild (default `!`). Cached for a minute. */
export async function getPrefix(guildId) {
  if (!guildId) return DEFAULT_PREFIX;
  const hit = prefixCache.get(guildId);
  if (hit && Date.now() - hit.at < PREFIX_TTL_MS) return hit.prefix;
  const prefix = (await getGuildSettings(guildId))?.prefix || DEFAULT_PREFIX;
  prefixCache.set(guildId, { prefix, at: Date.now() });
  return prefix;
}

/**
 * Set the guild's prefix (null / default resets it). Throws on an invalid prefix.
 * @param {string} guildId
 * @param {string | null} prefix
 */
export async function setPrefix(guildId, prefix) {
  const value = prefix == null || prefix === DEFAULT_PREFIX ? null : prefix;
  if (value !== null) {
    const err = prefixError(value);
    if (err) throw new RangeError(err);
  }
  await put(guildId, 'prefix', value);
  prefixCache.set(guildId, { prefix: value ?? DEFAULT_PREFIX, at: Date.now() });
}
