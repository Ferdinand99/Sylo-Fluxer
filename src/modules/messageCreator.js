// Message Creator: turn a dashboard "spec" into a Fluxer message and send or
// edit it as the bot. Supports content and embeds. Fluxer has no message
// components, so the spec's component rows are rendered as:
//   - link buttons  → a line of markdown links under the content;
//   - role buttons and the role select → role reactions: a legend line per role
//     and a reaction on the message; reacting toggles the role (see
//     handleRoleReaction, fed from bot/events/moduleEvents.js).
import { EmbedBuilder } from '../platform/index.js';
import { getMessageRoleChoices, setMessageRoleChoices } from '../db/messageRoleReactions.js';
import { log } from '../lib/log.js';
import { fetchGuildChannel } from '../platform/channels.js';

const hexToInt = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h ?? ''));
  return m ? parseInt(m[1], 16) : null;
};
const trimOr = (v, max, fallback = undefined) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : fallback;
};
const isUrl = (v) => /^https?:\/\/\S+$/i.test(String(v ?? ''));

/** Build one embed from a spec object, or null if it would be empty. */
export function buildEmbed(e) {
  const eb = new EmbedBuilder();
  let hasContent = false;

  const title = trimOr(e.title, 256);
  if (title) (eb.setTitle(title), (hasContent = true));
  const desc = trimOr(e.description, 4096);
  if (desc) (eb.setDescription(desc), (hasContent = true));
  if (isUrl(e.url)) eb.setURL(e.url);

  const color = hexToInt(e.color);
  if (color != null) eb.setColor(color);

  if (trimOr(e.authorName, 256)) {
    eb.setAuthor({
      name: trimOr(e.authorName, 256),
      iconURL: isUrl(e.authorIcon) ? e.authorIcon : undefined,
      url: isUrl(e.authorUrl) ? e.authorUrl : undefined,
    });
    hasContent = true;
  }
  if (trimOr(e.footerText, 2048)) {
    eb.setFooter({
      text: trimOr(e.footerText, 2048),
      iconURL: isUrl(e.footerIcon) ? e.footerIcon : undefined,
    });
    hasContent = true;
  }
  if (isUrl(e.thumbnail)) (eb.setThumbnail(e.thumbnail), (hasContent = true));
  if (isUrl(e.image)) (eb.setImage(e.image), (hasContent = true));
  if (e.timestamp) eb.setTimestamp(Date.now());

  const fields = (Array.isArray(e.fields) ? e.fields : [])
    .map((f) => ({ name: trimOr(f.name, 256), value: trimOr(f.value, 1024), inline: Boolean(f.inline) }))
    .filter((f) => f.name && f.value)
    .slice(0, 25);
  if (fields.length) (eb.addFields(fields), (hasContent = true));

  return hasContent ? eb : null;
}

const KEYCAPS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const CUSTOM_EMOJI = /^<a?:([a-zA-Z0-9_]+):(\d{17,20})>$/;

/** { key, react, display } for a unicode or <:name:id> emoji, or null. */
function parseChoiceEmoji(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = CUSTOM_EMOJI.exec(s);
  if (m) return { key: m[2], react: `${m[1]}:${m[2]}`, display: s };
  if (/^[\p{L}\p{N}\s_.-]+$/u.test(s)) return null; // plain text, not an emoji
  return { key: s, react: s, display: s };
}

/** Link buttons from the spec's rows, as `[label](url)`. */
function linkButtons(spec) {
  const out = [];
  for (const row of Array.isArray(spec.rows) ? spec.rows : []) {
    if (row.type === 'roleselect') continue;
    for (const b of Array.isArray(row.buttons) ? row.buttons : []) {
      if (b.style !== 'link' || !isUrl(b.url)) continue;
      const label = [trimOr(b.emoji, 64), trimOr(b.label, 80)].filter(Boolean).join(' ') || b.url;
      out.push(`[${label}](${b.url})`);
    }
  }
  return out;
}

/**
 * Role choices from the spec's role buttons and role select, each with a
 * reaction emoji (its own, or the next free keycap).
 * @returns {import('../db/messageRoleReactions.js').RoleChoice[]}
 */
export function roleChoices(spec) {
  const raw = [];
  for (const row of Array.isArray(spec.rows) ? spec.rows : []) {
    if (row.type === 'roleselect') {
      for (const o of Array.isArray(row.options) ? row.options : []) {
        if (/^\d{17,20}$/.test(String(o.roleId ?? ''))) {
          raw.push({ roleId: String(o.roleId), label: trimOr(o.label, 100), emoji: o.emoji });
        }
      }
      continue;
    }
    for (const b of Array.isArray(row.buttons) ? row.buttons : []) {
      if (b.style !== 'link' && /^\d{17,20}$/.test(b.roleId ?? '')) {
        raw.push({ roleId: b.roleId, label: trimOr(b.label, 80), emoji: b.emoji });
      }
    }
  }
  const seen = new Set();
  const withEmoji = raw
    .filter((c) => !seen.has(c.roleId) && seen.add(c.roleId))
    .map((c) => ({ ...c, parsed: parseChoiceEmoji(c.emoji) }));
  const used = new Set(withEmoji.map((c) => c.parsed?.key).filter(Boolean));
  const spare = KEYCAPS.filter((k) => !used.has(k));
  const out = [];
  for (const c of withEmoji) {
    let e = c.parsed && !out.some((o) => o.key === c.parsed.key) ? c.parsed : null;
    if (!e) {
      const k = spare.shift();
      if (!k) break; // more roles than reactions we can hand out
      e = { key: k, react: k, display: k };
    }
    out.push({ key: e.key, react: e.react, display: e.display, roleId: c.roleId, label: c.label });
  }
  return out.slice(0, 20);
}

/**
 * @param {object} spec
 * @returns {{ payload: import('@fluxerjs/core').MessageSendOptions, empty: boolean, choices: object[] }}
 */
export function buildPayload(spec) {
  const base = trimOr(spec.content, 2000);
  const links = linkButtons(spec);
  const choices = roleChoices(spec);
  const legend = choices.map((c) => `${c.display} ${c.label ? `${c.label} — ` : ''}<@&${c.roleId}>`);
  const content = [
    base,
    links.join(' · '),
    legend.length ? `React to pick a role:\n${legend.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4000);
  const embeds = (Array.isArray(spec.embeds) ? spec.embeds : []).slice(0, 10).map(buildEmbed).filter(Boolean);
  const empty = !content && embeds.length === 0;
  return {
    payload: { content: content || undefined, embeds, allowedMentions: { parse: ['users'] } },
    empty,
    choices,
  };
}

/** Put the role reactions on a posted message and remember the mapping. */
export async function applyRoleReactions(guild, message, choices) {
  await setMessageRoleChoices(guild.id, message.channelId, message.id, choices);
  for (const c of choices) {
    await message
      .react(c.react)
      .catch((err) => log.warn('messageCreator', `react ${c.display}: ${err.message}`));
  }
}

async function resolveChannel(guild, channelId) {
  const ch =
    guild.channels.cache.get(channelId) ?? (await fetchGuildChannel(guild, channelId).catch(() => null));
  if (!ch?.isTextBased()) throw new Error('Channel not found or not text-based.');
  const me = guild.members.me;
  if (me && !ch.permissionsFor(me)?.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
    throw new Error('The bot lacks View Channel / Send Messages / Embed Links there.');
  }
  return ch;
}

export async function sendComposed(guild, channelId, spec) {
  const { payload, empty, choices } = buildPayload(spec);
  if (empty) throw new Error('Nothing to send — add content or an embed.');
  const channel = await resolveChannel(guild, channelId);
  const message = await channel.send(payload);
  if (choices.length) await applyRoleReactions(guild, message, choices);
  return message;
}

export async function editComposed(guild, channelId, messageId, spec) {
  const { payload, empty, choices } = buildPayload(spec);
  if (empty) throw new Error('Nothing to send — add content or an embed.');
  const channel = await resolveChannel(guild, channelId);
  const message = await channel.messages.fetch(messageId);
  await message.edit({ content: payload.content ?? '', embeds: payload.embeds });
  const previous = (await getMessageRoleChoices(guild.id, messageId)) ?? [];
  const keep = new Set(choices.map((c) => c.key));
  for (const old of previous) {
    if (!keep.has(old.key)) await message.removeReactionEmoji(old.react).catch(() => {});
  }
  await applyRoleReactions(guild, message, choices);
  return message;
}

// --- role reactions ---------------------------------------------------------

/**
 * Toggle a role when a member reacts on (or un-reacts from) a message posted
 * with role reactions. Returns true when the message had role reactions.
 * @param {'add' | 'remove'} kind
 * @param {{ reaction: any, user: import('@fluxerjs/core').User }} payload
 */
export async function handleRoleReaction(kind, { reaction, user }) {
  if (user.bot) return false;
  const guild = reaction.message?.guild;
  if (!guild) return false;
  const choices = await getMessageRoleChoices(guild.id, reaction.message.id);
  if (!choices?.length) return false;
  const key = reaction.emoji.id || reaction.emoji.name;
  const choice = choices.find((c) => c.key === key);
  if (!choice) return true;
  const role = guild.roles.get(choice.roleId);
  if (!role?.editable) {
    log.warn(
      'messageCreator',
      `cannot manage role ${choice.roleId} in ${guild.id} (missing, or ranked above Sylo)`
    );
    return true;
  }
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return true;
  const has = member.roles.cache.has(role.id);
  if (kind === 'add' && !has)
    await member.roles.add(role).catch((e) => log.warn('messageCreator', e.message));
  if (kind === 'remove' && has)
    await member.roles.remove(role).catch((e) => log.warn('messageCreator', e.message));
  return true;
}
