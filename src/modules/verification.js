// Verification / gate: new members react ✅ on the verify message (and
// optionally pass a Cloudflare Turnstile captcha on the dashboard) to get a
// role. Fluxer has no buttons, so the reaction is the "Verify" click; Sylo
// removes it again straight away so the message stays clean.
//
// config shape:
//   {
//     mode: 'button' | 'captcha',       // 'button' = react to verify; captcha falls back to it when Turnstile is unconfigured
//     verifiedRoleId: '',
//     channelId: '',                    // where the verify message is posted
//     messageId: '',                    // id of that message (bot-managed)
//     title: 'Verification',
//     message: '...',
//     successMessage: '...',
//     logChannelId: '',
//     kickAfterMinutes: 0,              // 0 = never kick unverified
//   }
import { createHmac, timingSafeEqual } from 'node:crypto';
import { EmbedBuilder } from '../platform/index.js';
import { on } from './dispatch.js';
import { config } from '../config.js';
import { getGuildModule, setGuildModule, isModuleEnabled } from '../db/modules.js';
import { sendToChannel } from './lib/send.js';
import { log } from '../lib/log.js';
import { fetchGuildChannel } from '../platform/channels.js';

export const VERIFY_MODES = ['button', 'captcha'];
const TOKEN_TTL_MS = 15 * 60 * 1000;
/** The reaction members add on the verify message. */
export const VERIFY_EMOJI = '✅';

const DEFAULTS = {
  mode: 'button',
  verifiedRoleId: '',
  channelId: '',
  messageId: '',
  title: 'Verification',
  message: 'React with ✅ below to verify and unlock the rest of the server.',
  successMessage: 'You are verified — welcome!',
  logChannelId: '',
  kickAfterMinutes: 0,
};

const clampInt = (v, min, max, dflt) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dflt;
};
const id = (v) => (/^\d{17,20}$/.test(v ?? '') ? v : '');

export function normaliseVerificationConfig(raw = {}) {
  return {
    mode: VERIFY_MODES.includes(raw.mode) ? raw.mode : 'button',
    verifiedRoleId: id(raw.verifiedRoleId),
    channelId: id(raw.channelId),
    messageId: id(raw.messageId),
    title: String(raw.title ?? DEFAULTS.title).slice(0, 200) || DEFAULTS.title,
    message: String(raw.message ?? DEFAULTS.message).slice(0, 1500) || DEFAULTS.message,
    successMessage:
      String(raw.successMessage ?? DEFAULTS.successMessage).slice(0, 1000) || DEFAULTS.successMessage,
    logChannelId: id(raw.logChannelId),
    kickAfterMinutes: clampInt(raw.kickAfterMinutes, 0, 10080, 0),
  };
}

/** Effective mode — captcha only when Turnstile keys are configured. */
export function effectiveMode(cfg) {
  return cfg.mode === 'captcha' && config.turnstileEnabled ? 'captcha' : 'button';
}

// --- signed link tokens --------------------------------------------------

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function signVerifyToken(guildId, userId) {
  const body = `${guildId}.${userId}.${Date.now() + TOKEN_TTL_MS}`;
  const sig = createHmac('sha256', config.sessionSecret).update(body).digest();
  return `${b64url(body)}.${b64url(sig)}`;
}

/** @returns {{ guildId: string, userId: string } | null} */
export function verifyVerifyToken(token) {
  try {
    const [bodyB64, sigB64] = String(token).split('.');
    if (!bodyB64 || !sigB64) return null;
    const body = Buffer.from(bodyB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const expected = createHmac('sha256', config.sessionSecret).update(body).digest();
    const got = Buffer.from(sigB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
    const [guildId, userId, exp] = body.split('.');
    if (!/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(userId)) return null;
    if (Date.now() > Number(exp)) return null;
    return { guildId, userId };
  } catch {
    return null;
  }
}

// --- the verify message ------------------------------------------------------

/** Make sure the guild's verify message exists; (re)post it and store the id. */
export async function ensureVerifyMessage(guild, cfg) {
  if (!cfg.channelId || !cfg.verifiedRoleId) return;
  const channel =
    guild.channels.cache.get(cfg.channelId) ??
    (await fetchGuildChannel(guild, cfg.channelId).catch(() => null));
  if (!channel?.isTextBased()) return;
  const me = guild.members.me;
  if (!channel.permissionsFor(me)?.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) return;

  if (cfg.messageId) {
    const existing = await channel.messages.fetch(cfg.messageId).catch(() => null);
    if (existing) {
      await existing.edit({ embeds: [verifyEmbed(cfg)] }).catch(() => {});
      await existing.react(VERIFY_EMOJI).catch(() => {});
      return;
    }
  }
  const posted = await channel.send({ embeds: [verifyEmbed(cfg)] }).catch(() => null);
  if (!posted) return;
  await posted.react(VERIFY_EMOJI).catch(() => {});
  const fresh = (await getGuildModule(guild.id, 'verification')).config;
  await setGuildModule(guild.id, 'verification', { config: { ...fresh, messageId: posted.id } });
}

function verifyEmbed(cfg) {
  return new EmbedBuilder().setColor(0x58d68d).setTitle(cfg.title).setDescription(cfg.message);
}

// --- granting the role -----------------------------------------------------

/** Add the verified role and log it. Returns 'ok' | 'already' | 'norole' | 'fail'. */
export async function grantVerified(guild, userId, cfg) {
  if (!cfg.verifiedRoleId) return 'norole';
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return 'fail';
  if (member.roles.cache.has(cfg.verifiedRoleId)) return 'already';

  const role = guild.roles.cache.get(cfg.verifiedRoleId);
  if (!role || !role.editable) return 'fail';

  try {
    await member.roles.add(role, 'Verification passed');
  } catch {
    return 'fail';
  }

  if (cfg.logChannelId) {
    await sendToChannel(guild.id, cfg.logChannelId, {
      embeds: [
        new EmbedBuilder()
          .setColor(0x58d68d)
          .setDescription(`✅ ${member.user.tag} (\`${member.id}\`) verified`)
          .setTimestamp(Date.now()),
      ],
    });
  }
  return 'ok';
}

// --- the ✅ reaction ----------------------------------------------------------

/**
 * Tell the member something privately: by DM, or — when their DMs are closed —
 * as a mention in the verify channel that deletes itself after a minute.
 */
async function tellMember(member, channel, content) {
  const dmed = await member.user.send({ content }).then(
    () => true,
    () => false
  );
  if (dmed || !channel) return;
  const note = await channel.send({ content: `<@${member.id}> ${content}` }).catch(() => null);
  if (note) setTimeout(() => note.delete().catch(() => {}), 60_000).unref();
}

on('verification', 'reactionAdd', async ({ reaction, user }, rawConfig, guildId) => {
  if (user.bot) return;
  const cfg = normaliseVerificationConfig(rawConfig);
  if (!cfg.messageId || reaction.message.id !== cfg.messageId) return;
  if ((reaction.emoji.id || reaction.emoji.name) !== VERIFY_EMOJI) return;
  // Clear their reaction so the message keeps a single ✅ from Sylo.
  reaction.users.remove(user.id).catch(() => {});

  const guild = reaction.message.guild;
  const member = await guild?.members.fetch(user.id).catch(() => null);
  if (!member) return;
  const channel = reaction.message.channel;

  if (!cfg.verifiedRoleId) {
    return tellMember(
      member,
      channel,
      'Verification is misconfigured — no role is set. Please tell a moderator.'
    );
  }
  if (member.roles.cache.has(cfg.verifiedRoleId))
    return tellMember(member, channel, 'You are already verified.');

  if (effectiveMode(cfg) === 'captcha' && config.dashboardUrl) {
    const url = `${config.dashboardUrl}/verify/${guildId}?t=${signVerifyToken(guildId, user.id)}`;
    return tellMember(
      member,
      channel,
      `One quick check — open this link to finish verifying in **${guild.name}** (expires in 15 minutes): ${url}`
    );
  }

  const result = await grantVerified(guild, user.id, cfg);
  if (result === 'ok') return tellMember(member, channel, cfg.successMessage);
  if (result !== 'already') {
    log.warn(
      'verification',
      `could not grant the verified role in ${guildId} (missing Manage Roles or ranked below it)`
    );
    return tellMember(
      member,
      channel,
      "That didn't work — please tell a moderator Sylo couldn't give you the role."
    );
  }
});

// --- kick unverified after a grace period -------------------------------

on('verification', 'guildMemberAdd', async (member, rawConfig) => {
  const cfg = normaliseVerificationConfig(rawConfig);
  // Ensure the verify message still exists (cheap no-op if it does).
  await ensureVerifyMessage(member.guild, cfg).catch(() => {});

  if (cfg.kickAfterMinutes <= 0 || !cfg.verifiedRoleId) return;
  const graceMs = cfg.kickAfterMinutes * 60_000;
  setTimeout(async () => {
    try {
      if (!(await isModuleEnabled(member.guild.id, 'verification'))) return;
      const fresh = normaliseVerificationConfig(
        (await getGuildModule(member.guild.id, 'verification')).config
      );
      const m = await member.guild.members.fetch(member.id).catch(() => null);
      if (!m || m.roles.cache.has(fresh.verifiedRoleId) || !m.kickable) return;
      await m.kick(`Did not verify within ${fresh.kickAfterMinutes} minutes`).catch(() => {});
    } catch {
      /* best-effort */
    }
  }, graceMs).unref();
});
