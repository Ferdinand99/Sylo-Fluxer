// Fires once when the Fluxer client has finished connecting (and, with
// waitForGuilds, received every guild).
import { Events } from '../../platform/index.js';
import { primeAllInviteCaches } from '../../modules/inviteTracker.js';
import { applyPresence } from '../lib/presence.js';
import { primeGuild } from '../lib/guildPrime.js';
import { log } from '../../lib/log.js';
import { recordGatewayPing } from '../../runtime.js';

export const name = Events.Ready;
export const once = true;

/** @param {import('@fluxerjs/core').Client} client  (appended by loadEvents; Ready has no args) */
export async function execute(client) {
  log.info('bot', `Logged in as ${client.user.tag} - serving ${client.guilds.size} guild(s)`);

  // `guild.members.me` is only populated once fetched; most permission checks
  // read it, so fetch it for every guild up front.
  await Promise.all([...client.guilds.values()].map((g) => primeGuild(g)));

  // Presence is configured from the dashboard; re-apply periodically so
  // {servers} / {members} placeholders stay current as the bot joins/leaves.
  applyPresence(client);
  setInterval(() => applyPresence(client), 10 * 60 * 1000).unref();

  // Sample the gateway heartbeat once a minute for the /health ping sparkline.
  recordGatewayPing(client.ws.ping);
  setInterval(() => recordGatewayPing(client.ws.ping), 60 * 1000).unref();

  // Cache each guild's current invite uses so the first join after a restart is
  // still attributable.
  primeAllInviteCaches(client).catch((err) =>
    log.error('invite-tracker', 'startup invite cache prime failed:', err.message)
  );
}
