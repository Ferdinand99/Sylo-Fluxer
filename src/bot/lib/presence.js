// Applies the dashboard-configured presence (status + activity) to the client.
import { ActivityType } from '../../platform/index.js';
import { getPresenceConfig } from '../../db/appSettings.js';
import { log } from '../../lib/log.js';

const TYPE_MAP = {
  Playing: ActivityType.Playing,
  Listening: ActivityType.Listening,
  Watching: ActivityType.Watching,
  Competing: ActivityType.Competing,
  Custom: ActivityType.Custom,
};

/** Substitute {servers} / {members} in the activity text. */
export function fillPresenceText(text, client) {
  const servers = client.guilds.size;
  const members = [...client.guilds.values()].reduce((sum, g) => sum + (g.memberCount ?? 0), 0);
  return String(text ?? '')
    .replaceAll('{servers}', String(servers))
    .replaceAll('{members}', String(members));
}

/** Read the stored presence config and push it to Fluxer. Never throws. */
export async function applyPresence(client) {
  if (!client?.user) return;
  try {
    const cfg = await getPresenceConfig();
    const type = TYPE_MAP[cfg.type] ?? ActivityType.Custom;
    const text = fillPresenceText(cfg.text, client).trim();

    // Fluxer shows a custom status natively; other types go out as activities.
    if (type === ActivityType.Custom) {
      client.user.setPresence({ status: cfg.status, activities: [], customStatus: text ? { text } : null });
    } else {
      client.user.setPresence({ status: cfg.status, activities: text ? [{ name: text, type }] : [] });
    }
  } catch (err) {
    log.error('bot', 'Failed to apply presence:', err.message);
  }
}
