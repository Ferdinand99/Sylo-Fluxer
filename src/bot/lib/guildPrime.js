// Per-guild warm-up: fetch the bot's own member (so `guild.members.me` and
// permission checks work) — run on startup and whenever the bot joins a guild.
import { log } from '../../lib/log.js';

/** @param {import('@fluxerjs/core').Guild} guild */
export async function primeGuild(guild) {
  try {
    await guild.members.fetchMe();
  } catch (err) {
    log.warn('bot', `Could not fetch own member in guild ${guild.id}:`, err.message);
  }
}
