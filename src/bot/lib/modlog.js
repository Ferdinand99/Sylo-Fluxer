// Posts moderation actions to a guild's configured mod-log channel, if any.
import { getGuildSettings } from '../../db/guildSettings.js';
import { fetchGuildChannel } from '../../platform/channels.js';

/**
 * Send an embed to the guild's mod-log channel. Never throws.
 * @param {import('@fluxerjs/core').Guild} guild
 * @param {import('@fluxerjs/core').EmbedBuilder} embed
 * @returns {Promise<boolean>} true if the message was sent, false if there is no
 *   usable mod-log channel (unconfigured, missing, wrong type, or missing perms)
 */
export async function postModLog(guild, embed) {
  const channelId = (await getGuildSettings(guild.id))?.modlog_channel_id;
  if (!channelId) return false;

  try {
    const channel = guild.channels.cache.get(channelId) ?? (await fetchGuildChannel(guild, channelId));
    if (!channel?.isTextBased()) return false;

    const me = guild.members.me;
    if (me && !channel.permissionsFor(me)?.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
      return false;
    }
    await channel.send({ embeds: [embed] });
    return true;
  } catch {
    // Channel deleted, permissions changed, etc. — logging is best-effort.
    return false;
  }
}
