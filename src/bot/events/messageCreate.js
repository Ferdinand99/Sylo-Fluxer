// Prefix commands: every message goes through the router (src/bot/framework/router.js),
// which ignores anything that isn't `<prefix>name …` / `@Sylo name …`.
import { Events } from '../../platform/index.js';
import { handleMessage } from '../framework/router.js';
import { log } from '../../lib/log.js';

export const name = Events.MessageCreate;

/** @param {import('@fluxerjs/core').Message} message */
export async function execute(message) {
  try {
    await handleMessage(message);
  } catch (err) {
    log.error('bot', 'command router failed:', err);
  }
}
