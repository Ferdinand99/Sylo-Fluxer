// Giveaways: `!giveaway start` posts an embed with a 🎉 reaction — reacting
// enters, removing the reaction leaves (Fluxer has no buttons). A background
// loop draws winners at the end time. `!giveaway reroll` and `end`, plus the
// dashboard, call endGiveaway() directly.
//
// config shape: { ping: 'none' | 'here' | 'everyone', dmWinners: boolean }
import { EmbedBuilder } from '../platform/index.js';
import { runtime } from '../runtime.js';
import { on } from './dispatch.js';
import { isModuleEnabled, getGuildModule } from '../db/modules.js';
import {
  getGiveaway,
  getGiveawayByMessage,
  dueGiveaways,
  markGiveawayEnded,
  setGiveawayWinners,
  addGiveawayEntry,
  removeGiveawayEntry,
  hasGiveawayEntry,
  giveawayEntryCount,
  giveawayEntrantIds,
} from '../db/giveaways.js';
import { log } from '../lib/log.js';
import { fetchGuildChannel } from '../platform/channels.js';

export const MIN_MS = 60_000; // 1 minute
export const MAX_MS = 60 * 86_400_000; // 60 days
export const MAX_WINNERS = 20;
const ACCENT = 0xf0b232;
/** The reaction members add to enter. */
export const ENTER_EMOJI = '🎉';

// Coalesced "N entries" footer refreshes — at most one message edit per
// COUNT_REFRESH_MS per giveaway (see scheduleCountRefresh). Keyed by giveaway id.
const COUNT_REFRESH_MS = 5000;
const pendingCountRefresh = new Map();

export function normaliseGiveawaysConfig(raw = {}) {
  return {
    ping: ['here', 'everyone'].includes(raw.ping) ? raw.ping : 'none',
    dmWinners: Boolean(raw.dmWinners),
  };
}

/**
 * Pick up to `n` distinct entries at random (Fisher-Yates). Pure — exported for
 * tests.
 * @param {string[]} pool
 * @param {number} n
 * @returns {string[]}
 */
export function pickWinners(pool, n) {
  const a = [...new Set(pool)];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, Math.min(n, a.length)));
}

/** Message payload for a giveaway in its current state. */
export function buildGiveawayPayload(g, { entryCount = 0 } = {}) {
  const endTs = Math.floor(g.ends_at / 1000);
  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle(`🎉 ${g.prize}`)
    .setTimestamp(g.created_at || Date.now());

  if (!g.ended) {
    embed.setDescription(
      [
        `React with ${ENTER_EMOJI} below to join — remove it to leave.`,
        '',
        `Ends: <t:${endTs}:R>  ·  <t:${endTs}:f>`,
        `Winners: **${g.winners}**`,
        g.required_role_id ? `Requires: <@&${g.required_role_id}>` : null,
        `Hosted by: <@${g.host_id}>`,
      ]
        .filter(Boolean)
        .join('\n')
    );
    embed.setFooter({ text: `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}` });
  } else {
    const won = g.wonIds || [];
    embed
      .setColor(0x4f545c)
      .setDescription(
        [
          won.length
            ? `Winner${won.length === 1 ? '' : 's'}: ${won.map((id) => `<@${id}>`).join(', ')}`
            : 'No valid entries — no winner drawn.',
          '',
          `Ended: <t:${endTs}:R>`,
          `Hosted by: <@${g.host_id}>`,
        ].join('\n')
      );
    embed.setFooter({ text: `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'} · giveaway ended` });
  }

  return { embeds: [embed], allowedMentions: { parse: [] } };
}

/**
 * Close a giveaway (or reroll it): draw winners from the current entrants,
 * update the message, and announce. Safe to call repeatedly.
 * @param {number} id
 * @param {{ rerollCount?: number }} [opts]
 * @returns {Promise<{ ok: boolean, reason?: string, winners?: string[] }>}
 */
export async function endGiveaway(id, opts = {}) {
  const g = await getGiveaway(id);
  if (!g) return { ok: false, reason: 'not-found' };

  const guild = runtime.client?.guilds.cache.get(g.guild_id);
  if (!guild) {
    await markGiveawayEnded(id, []);
    return { ok: false, reason: 'no-guild' };
  }
  const channel =
    guild.channels.cache.get(g.channel_id) ??
    (await fetchGuildChannel(guild, g.channel_id).catch(() => null));

  // Eligible = entrants still in the guild (and still holding the required role).
  const entrants = await giveawayEntrantIds(id);
  const exclude = new Set(opts.rerollCount ? g.wonIds : []);
  const eligible = [];
  for (const uid of entrants) {
    if (exclude.has(uid)) continue;
    const member = guild.members.cache.get(uid) ?? (await guild.members.fetch(uid).catch(() => null));
    if (!member) continue;
    if (g.required_role_id && !member.roles.cache.has(g.required_role_id)) continue;
    eligible.push(uid);
  }

  const count = opts.rerollCount ? Math.max(1, Math.min(opts.rerollCount, MAX_WINNERS)) : g.winners;
  const winners = pickWinners(eligible, count);

  if (opts.rerollCount) await setGiveawayWinners(id, winners);
  else await markGiveawayEnded(id, winners);

  const fresh = await getGiveaway(id);
  const entryCount = await giveawayEntryCount(id);

  const pending = pendingCountRefresh.get(id);
  if (pending) {
    clearTimeout(pending);
    pendingCountRefresh.delete(id);
  }

  if (channel?.isTextBased?.() && g.message_id) {
    const msg = await channel.messages.fetch(g.message_id).catch(() => null);
    if (msg) await msg.edit(buildGiveawayPayload(fresh, { entryCount })).catch(() => {});
  }

  if (channel?.isTextBased?.()) {
    const cfg = normaliseGiveawaysConfig((await getGuildModule(g.guild_id, 'giveaways')).config);
    // A reroll never re-pings the whole channel — only the original draw does.
    const pinging = !opts.rerollCount && cfg.ping !== 'none';
    const lead = pinging ? (cfg.ping === 'everyone' ? '@everyone ' : '@here ') : '';
    const body = winners.length
      ? `${lead}🎉 Congratulations ${winners.map((w) => `<@${w}>`).join(', ')} — you won **${g.prize}**!`
      : `Nobody entered **${g.prize}**, so there is no winner.`;
    await channel
      .send({
        content: body,
        // 'everyone' parse covers both @everyone and @here.
        allowedMentions: { users: winners, parse: pinging ? ['everyone'] : [] },
      })
      .catch(() => {});

    if (cfg.dmWinners && winners.length) {
      for (const w of winners) {
        const user = await runtime.client.users.fetch(w).catch(() => null);
        await user?.send(`You won **${g.prize}** in ${guild.name}! 🎉`).catch(() => {});
      }
    }
  }

  return { ok: true, winners };
}

// --- entry reaction ------------------------------------------------------

/** Queue a trailing footer refresh; a burst of reactions yields one edit / 5s. */
function scheduleCountRefresh(message, id) {
  if (pendingCountRefresh.has(id)) return;
  const t = setTimeout(async () => {
    pendingCountRefresh.delete(id);
    const g = await getGiveaway(id);
    if (!g || g.ended) return;
    message.edit(buildGiveawayPayload(g, { entryCount: await giveawayEntryCount(id) })).catch(() => {});
  }, COUNT_REFRESH_MS);
  t.unref?.();
  pendingCountRefresh.set(id, t);
}

const isEnterReaction = (reaction) => (reaction.emoji.id || reaction.emoji.name) === ENTER_EMOJI;

on('giveaways', 'reactionAdd', async ({ reaction, user }) => {
  if (user.bot || !isEnterReaction(reaction)) return;
  const g = await getGiveawayByMessage(reaction.message.id);
  if (!g) return;
  if (g.ended) {
    reaction.users.remove(user.id).catch(() => {});
    return;
  }
  if (g.required_role_id) {
    const member = await reaction.message.guild?.members.fetch(user.id).catch(() => null);
    if (!member?.roles.cache.has(g.required_role_id)) {
      reaction.users.remove(user.id).catch(() => {});
      const role = reaction.message.guild?.roles.get(g.required_role_id);
      user
        .send(`You need the **${role?.name ?? 'required'}** role to enter the giveaway for **${g.prize}**.`)
        .catch(() => {});
      return;
    }
  }
  if (!(await hasGiveawayEntry(g.id, user.id))) await addGiveawayEntry(g.id, user.id);
  scheduleCountRefresh(reaction.message, g.id);
});

on('giveaways', 'reactionRemove', async ({ reaction, user }) => {
  if (user.bot || !isEnterReaction(reaction)) return;
  const g = await getGiveawayByMessage(reaction.message.id);
  if (!g || g.ended) return;
  await removeGiveawayEntry(g.id, user.id);
  scheduleCountRefresh(reaction.message, g.id);
});

// --- expiry loop ----------------------------------------------------

const TICK_MS = 20_000;
async function tick() {
  if (!runtime.client?.isReady()) return;
  for (const g of await dueGiveaways(Date.now())) {
    if ((await isModuleEnabled(g.guild_id, 'giveaways')) && runtime.client.guilds.cache.has(g.guild_id)) {
      endGiveaway(g.id).catch((err) => log.error('giveaways', 'auto-end failed:', err.message));
    } else {
      await markGiveawayEnded(g.id, []); // module off / bot gone — just close it
    }
  }
}
const timer = setInterval(() => {
  tick().catch((err) => log.error('giveaways', 'tick failed:', err.message));
}, TICK_MS);
timer.unref();
