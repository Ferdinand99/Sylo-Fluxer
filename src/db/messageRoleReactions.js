// Emoji → role mappings for messages Sylo posted with role reactions (the
// Fluxer replacement for role buttons / role select menus on composed
// messages). Keyed by message id so a reaction can be resolved no matter which
// feature posted the message (message builder, welcome channel, scheduled
// message, …).
import { prepare, registerPostgresBootstrap } from './driver.js';

registerPostgresBootstrap(`
  CREATE TABLE IF NOT EXISTS message_role_reactions (
    message_id TEXT PRIMARY KEY,
    guild_id   TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    choices    TEXT NOT NULL DEFAULT '[]',
    updated_at BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_message_role_reactions_guild ON message_role_reactions (guild_id);
`);

const getStmt = prepare('SELECT * FROM message_role_reactions WHERE guild_id = ? AND message_id = ?');
const upsertStmt = prepare(`
  INSERT INTO message_role_reactions (message_id, guild_id, channel_id, choices, updated_at)
  VALUES (@messageId, @guildId, @channelId, @choices, @now)
  ON CONFLICT (message_id) DO UPDATE SET guild_id = @guildId, channel_id = @channelId, choices = @choices, updated_at = @now
`);
const deleteStmt = prepare('DELETE FROM message_role_reactions WHERE guild_id = ? AND message_id = ?');

/**
 * @typedef {{ key: string, react: string, display: string, roleId: string, label?: string }} RoleChoice
 */

/** @returns {Promise<RoleChoice[] | null>} */
export async function getMessageRoleChoices(guildId, messageId) {
  const row = await getStmt.get(guildId, messageId);
  if (!row) return null;
  try {
    const v = JSON.parse(row.choices);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Store (or clear, with an empty list) a message's role choices. */
export async function setMessageRoleChoices(guildId, channelId, messageId, choices) {
  if (!choices?.length) {
    await deleteStmt.run(guildId, messageId);
    return;
  }
  await upsertStmt.run({ messageId, guildId, channelId, choices: JSON.stringify(choices), now: Date.now() });
}
