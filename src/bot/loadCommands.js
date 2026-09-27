// Discover and load every command module in ./commands.
// Each command module must export `data` (a CommandBuilder) and
// `execute(interaction)` — see src/bot/framework/.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Collection } from '../platform/index.js';
import { log } from '../lib/log.js';

const commandsDir = join(dirname(fileURLToPath(import.meta.url)), 'commands');

/**
 * @returns {Promise<Collection<string, { data: import('./framework/CommandBuilder.js').CommandBuilder, execute: Function }>>}
 */
export async function loadCommands() {
  const commands = new Collection();
  const files = readdirSync(commandsDir).filter((f) => f.endsWith('.js') && !f.startsWith('_'));

  for (const file of files) {
    const mod = await import(pathToFileURL(join(commandsDir, file)).href);
    if (!mod.data || typeof mod.execute !== 'function') {
      log.warn('bot', `Skipping ${file}: missing "data" or "execute" export`);
      continue;
    }
    commands.set(mod.data.name, { data: mod.data, execute: mod.execute });
  }

  return commands;
}
