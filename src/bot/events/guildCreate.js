// Sylo joined a guild after startup — warm up what permission checks need.
import { Events } from '../../platform/index.js';
import { primeGuild } from '../lib/guildPrime.js';
import { log } from '../../lib/log.js';

export const name = Events.GuildCreate;

/** @param {import('@fluxerjs/core').Guild} guild */
export async function execute(guild) {
  log.info('bot', `Joined guild ${guild.id} (${guild.name})`);
  await primeGuild(guild);
}
