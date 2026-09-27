// Fluxer client bootstrap: build the client, load commands and events, and log in.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// Platform first: importing it installs the SDK compatibility aliases.
import { Client } from '../platform/index.js';
import { clientInstanceOptions } from '../platform/urls.js';
import { config } from '../config.js';
import { setClient } from '../runtime.js';
import { loadCommands } from './loadCommands.js';
import { resolveShardOptions } from './lib/shards.js';
import { log } from '../lib/log.js';

const eventsDir = join(dirname(fileURLToPath(import.meta.url)), 'events');

/**
 * Wire up every event module in ./events onto the client. A module either
 * exports { name, execute[, once] } for a single listener, or a
 * register(client) function that attaches its own listeners. `execute` gets
 * the event's arguments followed by the client (Fluxer's Ready carries none).
 */
async function loadEvents(client) {
  const files = readdirSync(eventsDir).filter((f) => f.endsWith('.js') && !f.startsWith('_'));
  for (const file of files) {
    const mod = await import(pathToFileURL(join(eventsDir, file)).href);
    if (typeof mod.register === 'function') {
      mod.register(client);
      continue;
    }
    if (!mod.name || typeof mod.execute !== 'function') {
      log.warn('bot', `Skipping event ${file}: missing "name"/"execute" or "register" export`);
      continue;
    }
    if (mod.once) client.once(mod.name, (...args) => mod.execute(...args, client));
    else client.on(mod.name, (...args) => mod.execute(...args, client));
  }
}

/**
 * Create the client, load everything, and log in. Resolves once login is
 * initiated; the "ready" event finishes the handshake.
 * @returns {Promise<import('@fluxerjs/core').Client>}
 */
export async function startBot() {
  const client = new Client({
    ...clientInstanceOptions(),
    // Internal sharding — every shard runs in this process, sharing one cache
    // and one DB connection. 'auto' stays at 1 shard until ~2,500+ guilds.
    ...resolveShardOptions(config.fluxerShardCount),
    // Emit Ready only after every guild has arrived, so startup work (member
    // priming, invite caches, presence counts) sees the full guild list.
    waitForGuilds: true,
    // Replies don't ping the author unless a command asks for it.
    defaultReplyPing: false,
  });

  const commands = await loadCommands();
  client.commands = commands;
  await loadEvents(client);

  // Surface library-level errors on the dashboard instead of letting them bubble.
  client.on('error', (err) => log.error('bot', 'gateway client error', err));
  client.on('shardError', (id, err) => log.error('bot', `shard ${id} error`, err));
  client.on('shardReady', (id) => log.info('bot', `shard ${id} connected`));

  await client.login(config.fluxerToken);
  setClient(client);
  return client;
}
