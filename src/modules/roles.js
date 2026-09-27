// Reaction roles & autoroles.
//
// config shape:
//   {
//     autoroles: ["<roleId>", ...],
//     reactionMessages: [
//       {
//         id, channelId, messageId,
//         style: "reaction",           // Fluxer has no buttons / select menus; older
//                                      // "buttons" / "select" entries publish as reactions
//         message: "",                 // plain text above the embed
//         embed: { ...embed spec },    // built with the WYSIWYG editor
//         exclusive: false,            // only one role from this set at a time
//         mode: "default" | "reverse", // reverse = reacting removes the role
//         pairs: [{ key, display, react, roleId, label? }],
//       }
//     ]
//   }
// `key` identifies a reaction (custom emoji id or unicode char). A pair saved
// without an emoji (allowed for the old button/select styles) gets a numbered
// keycap by position — see effectivePairs().
import { on } from './dispatch.js';
import { runtime } from '../runtime.js';
import { sendComposed, editComposed } from './messageCreator.js';
import { log } from '../lib/log.js';

// --- emoji parsing --------------------------------------------------------

const CUSTOM_RE = /^<a?:([a-zA-Z0-9_]+):(\d+)>$/;

/**
 * Turn a user-entered emoji into { key, display, react } or null.
 * react is what message.react() accepts.
 * @param {string} raw
 * @param {import('@fluxerjs/core').Guild} guild
 */
export function parseEmoji(raw, guild) {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  const m = s.match(CUSTOM_RE);
  if (m) {
    return { key: m[2], display: s, react: `${m[1]}:${m[2]}` };
  }
  // :shortcode: → resolve against the guild's custom emojis
  const short = s.match(/^:([a-zA-Z0-9_]+):$/);
  if (short) {
    const e = guild.emojis.cache.find((x) => x.name === short[1]);
    if (e) return { key: e.id, display: e.toString(), react: `${e.name}:${e.id}` };
    return null;
  }
  // Assume a unicode emoji (grapheme). Keep as-is.
  return { key: s, display: s, react: s };
}

// --- pairs ------------------------------------------------------------------

const KEYCAPS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

const validPairs = (rm) => (rm.pairs || []).filter((p) => /^\d{17,20}$/.test(p.roleId || ''));

/**
 * The role pairs as members will see them: every pair has an emoji. Pairs
 * without one get the next unused keycap (1️⃣, 2️⃣, …) in list order, so the
 * mapping is stable as long as the list isn't reordered.
 */
export function effectivePairs(rm) {
  const used = new Set(
    validPairs(rm)
      .map((p) => p.key)
      .filter(Boolean)
  );
  const spare = KEYCAPS.filter((k) => !used.has(k));
  return validPairs(rm).flatMap((p) => {
    if (p.key) return [p];
    const k = spare.shift();
    return k ? [{ ...p, key: k, display: k, react: k }] : [];
  });
}

// --- dashboard helper: publish / re-publish a role message --------------

/** The embed spec for a role message — the configured embed, or an auto list. */
function roleMessageEmbedSpec(rm) {
  const e = rm.embed || {};
  const hasContent = e.title || e.description || e.image || (e.fields || []).length;
  if (hasContent) return e;
  const lines = effectivePairs(rm)
    .map((p) => `${p.display} ${p.label ? `${p.label} — ` : ''}<@&${p.roleId}>`)
    .join('\n');
  return { ...e, description: lines };
}

/**
 * Send (or edit) a role message and reconcile its reactions with the pairs.
 * @param {import('@fluxerjs/core').Guild} guild
 * @param {object} rm  entry from config.reactionMessages (see shape above)
 * @returns {Promise<string>} the message id
 */
export async function publishReactionMessage(guild, rm) {
  const pairs = effectivePairs(rm);
  const spec = { content: rm.message || '', embeds: [roleMessageEmbedSpec(rm)] };
  let message = null;
  if (rm.messageId) {
    message = await editComposed(guild, rm.channelId, rm.messageId, spec).catch(() => null);
  }
  if (!message) message = await sendComposed(guild, rm.channelId, spec);

  const wanted = new Set(pairs.map((p) => p.key));
  try {
    for (const rx of message.reactions.cache.values()) {
      const k = rx.emoji.id || rx.emoji.name;
      if (!wanted.has(k)) await rx.remove().catch(() => {});
    }
  } catch {
    /* best-effort */
  }
  for (const p of pairs) {
    await message.react(p.react).catch((err) => log.warn('roles', `react ${p.display}: ${err.message}`));
  }
  return message.id;
}

// --- runtime handlers --------------------------------------------------

on('roles', 'guildMemberAdd', async (member, config) => {
  const ids = Array.isArray(config.autoroles) ? config.autoroles : [];
  if (!ids.length) return;
  const me = member.guild.members.me;
  const addable = ids.filter((id) => {
    const role = member.guild.roles.cache.get(id);
    return role && role.editable && me && me.roles.highest.comparePositionTo(role) > 0;
  });
  if (addable.length) await member.roles.add(addable, 'Autorole on join').catch(() => {});
});

async function resolveReaction(payload) {
  let { reaction, user } = payload;
  if (user.bot) return null;
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return null;
    }
  }
  return { reaction, user };
}

function findPair(config, reaction) {
  const key = reaction.emoji.id || reaction.emoji.name;
  for (const rm of config.reactionMessages ?? []) {
    if (rm.messageId !== reaction.message.id) continue;
    const pair = effectivePairs(rm).find((p) => p.key === key);
    if (pair) return { rm, pair };
  }
  return null;
}

on('roles', 'reactionAdd', async (payload, config, guildId) => {
  const r = await resolveReaction(payload);
  if (!r) return;
  const hit = findPair(config, r.reaction);
  if (!hit) return;
  const guild = runtime.client.guilds.cache.get(guildId);
  const member = await guild.members.fetch(r.user.id).catch(() => null);
  const role = guild.roles.cache.get(hit.pair.roleId);
  if (!member || !role) return;
  if (!role.editable) {
    log.warn(
      'roles',
      `cannot assign "${role.name}" in ${guild.name}: bot lacks Manage Roles or is ranked below it`
    );
    return;
  }

  if (hit.rm.mode === 'reverse') {
    await member.roles
      .remove(role, 'Reaction role (reverse)')
      .catch((e) => log.warn('roles', `remove failed: ${e.message}`));
    return;
  }

  await member.roles
    .add(role, 'Reaction role')
    .catch((err) => log.warn('roles', `add role failed: ${err.message}`));

  if (hit.rm.exclusive) {
    const others = effectivePairs(hit.rm)
      .filter((p) => p.roleId !== hit.pair.roleId && member.roles.cache.has(p.roleId))
      .map((p) => p.roleId);
    if (others.length) await member.roles.remove(others, 'Reaction role (exclusive)').catch(() => {});
    // drop the member's other reactions on this message so it reflects the switch
    for (const rx of r.reaction.message.reactions.cache.values()) {
      if ((rx.emoji.id || rx.emoji.name) !== (r.reaction.emoji.id || r.reaction.emoji.name)) {
        rx.users.remove(r.user.id).catch(() => {});
      }
    }
  }
});

on('roles', 'reactionRemove', async (payload, config, guildId) => {
  const r = await resolveReaction(payload);
  if (!r) return;
  const hit = findPair(config, r.reaction);
  if (!hit) return;
  const guild = runtime.client.guilds.cache.get(guildId);
  const member = await guild.members.fetch(r.user.id).catch(() => null);
  const role = guild.roles.cache.get(hit.pair.roleId);
  if (!member || !role || !role.editable) return;

  if (hit.rm.mode === 'reverse') {
    await member.roles.add(role, 'Reaction role (reverse, un-react)').catch(() => {});
  } else if (!hit.rm.exclusive) {
    await member.roles.remove(role, 'Reaction role removed').catch(() => {});
  }
});
