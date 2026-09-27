// Sylo was removed from (or left) a guild — drop everything stored for it.
import { Events } from '../../platform/index.js';
import { purgeGuild } from '../../db/purge.js';
import { log } from '../../lib/log.js';

export const name = Events.GuildDelete;

/** @param {import('@fluxerjs/core').Guild} guild */
export async function execute(guild) {
  // Fluxer only emits GuildDelete for a real removal; an outage arrives as
  // GuildUnavailable instead. Keep the guard anyway in case that ever changes.
  if (guild.available === false) return;
  try {
    await purgeGuild(guild.id);
    log.info('bot', `Left guild ${guild.id} (${guild.name ?? 'unknown'}) — purged stored data`);
  } catch (err) {
    log.error('bot', `Failed to purge data for guild ${guild.id}:`, err.message);
  }
}
