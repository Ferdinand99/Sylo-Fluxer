// Loads and validates environment configuration for Sylo.
// All secrets and tunables come from environment variables (see .env.example).
import 'dotenv/config';
import { randomBytes } from 'node:crypto';

/**
 * Read a required string env var, or exit with a clear message.
 * @param {string} name
 * @returns {string}
 */
function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    console.error(
      `[config] Missing required environment variable: ${name}\n` +
        `Copy .env.example to .env and fill in the values, or set it in your environment.`
    );
    process.exit(1);
  }
  return value.trim();
}

/**
 * Read an optional string env var with a fallback default.
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
function optional(name, fallback) {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

/**
 * Read an optional string env var, or `null` when unset.
 * @param {string} name
 * @returns {string | null}
 */
function optionalOrNull(name) {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : null;
}

const cacheTtlMinutes = Number(optional('STATS_CACHE_TTL_MINUTES', '5'));
if (!Number.isFinite(cacheTtlMinutes) || cacheTtlMinutes <= 0) {
  console.error('[config] STATS_CACHE_TTL_MINUTES must be a positive number.');
  process.exit(1);
}

const webPort = Number(optional('WEB_PORT', '3000'));
if (!Number.isInteger(webPort) || webPort <= 0 || webPort > 65535) {
  console.error('[config] WEB_PORT must be an integer between 1 and 65535.');
  process.exit(1);
}

// Automatic database backups: compacted single-file snapshots written via
// SQLite "VACUUM INTO" to BACKUP_DIR (default <db dir>/backups). A snapshot is
// also taken automatically just before any schema migration. Set the interval
// to 0 to turn off the scheduled backup (pre-migration + manual still run).
const backupIntervalHours = Number(optional('BACKUP_INTERVAL_HOURS', '24'));
if (!Number.isFinite(backupIntervalHours) || backupIntervalHours < 0) {
  console.error('[config] BACKUP_INTERVAL_HOURS must be 0 or a positive number.');
  process.exit(1);
}
const backupRetention = Number(optional('BACKUP_RETENTION', '14'));
if (!Number.isInteger(backupRetention) || backupRetention < 1) {
  console.error('[config] BACKUP_RETENTION must be a whole number of 1 or more.');
  process.exit(1);
}

// Off-site backup targets (optional). After every local snapshot a gzipped copy
// is shipped to whichever of these is set. Both are best-effort.
const backupWebdavUrl = optionalOrNull('BACKUP_WEBDAV_URL');
const backupWebdavUser = optionalOrNull('BACKUP_WEBDAV_USER');
const backupWebdavPass = optionalOrNull('BACKUP_WEBDAV_PASS');
const backupWebhookUrl = optionalOrNull('BACKUP_WEBHOOK_URL');
if (backupWebhookUrl && !/^https:\/\//i.test(backupWebhookUrl)) {
  console.warn('[config] BACKUP_WEBHOOK_URL should be an https webhook URL.');
}

// Internal sharding: how many gateway shards this single process runs. 'auto'
// (the default) derives the count from the guild count — it stays 1 until the
// bot is in ~2,500+ servers, so it is a no-op for small instances. A positive
// integer pins the count. This is always one process; multi-process sharding is
// not supported.
const shardCountRaw = optional('FLUXER_SHARD_COUNT', 'auto').toLowerCase();
let fluxerShardCount = 'auto';
if (shardCountRaw !== 'auto') {
  fluxerShardCount = Number(shardCountRaw);
  if (!Number.isInteger(fluxerShardCount) || fluxerShardCount < 1) {
    console.error("[config] FLUXER_SHARD_COUNT must be 'auto' or a positive integer.");
    process.exit(1);
  }
}

// Which Fluxer instance to talk to. Unset = hosted Fluxer (fluxer.app). For a
// self-hosted instance set FLUXER_API_URL (its public API origin, e.g.
// https://api.chat.example.com) and FLUXER_WEB_URL (its web app origin).
const fluxerApiUrl = optionalOrNull('FLUXER_API_URL')?.replace(/\/+$/, '') ?? null;
const fluxerWebUrl = optionalOrNull('FLUXER_WEB_URL')?.replace(/\/+$/, '') ?? null;

// How timestamps are rendered in bot messages: 'native' uses the <t:unix:style>
// markup (rendered in the reader's timezone by clients that support it),
// 'text' writes a plain UTC string.
const fluxerTimestamps = optional('FLUXER_TIMESTAMPS', 'native').toLowerCase();
if (!['native', 'text'].includes(fluxerTimestamps)) {
  console.error("[config] FLUXER_TIMESTAMPS must be 'native' or 'text'.");
  process.exit(1);
}

// Hosted-only, opt-in Postgres driver (see docs/roadmap.md — "Postgres
// migration line"). Unset (the default) — and every self-hosted deployment —
// keeps today's SQLite path untouched. Currently READ-ONLY: nothing in
// src/db/ consults it yet; that lands in a follow-up PR.
const databaseUrl = optionalOrNull('DATABASE_URL');
if (databaseUrl && !/^postgres(ql)?:\/\//i.test(databaseUrl)) {
  console.error('[config] DATABASE_URL must start with postgres:// or postgresql://.');
  process.exit(1);
}

// Dashboard auth. When FLUXER_CLIENT_SECRET is set, the dashboard requires
// "Log in with Fluxer" and gates actions to guild admins. When unset, the
// dashboard runs in open mode (localhost / trusted LAN only).
const fluxerClientSecret = optionalOrNull('FLUXER_CLIENT_SECRET');
// Bot-wide operator ids (comma/space-separated Fluxer user ids). Gates /health
// — status, error log and database backup/restore across every server — to just
// these accounts, instead of any signed-in dashboard user.
const ownerIds = (optionalOrNull('OWNER_IDS') ?? '')
  .split(/[\s,]+/)
  .map((s) => s.trim())
  .filter(Boolean);
const badOwnerIds = ownerIds.filter((id) => !/^\d{17,20}$/.test(id));
if (badOwnerIds.length) {
  console.error(`[config] OWNER_IDS has invalid id(s): ${badOwnerIds.join(', ')}`);
  process.exit(1);
}
// Channel Sylo posts its own operational errors to (a "dev-log", distinct from
// any per-guild logging/modlog channel a server admin configures — this is
// Sylo's own health signal, not moderation activity). Optional; unset means
// no proactive notification, matching every other opt-in integration here.
const devLogChannelId = optionalOrNull('DEV_LOG_CHANNEL_ID');
if (devLogChannelId && !/^\d{17,20}$/.test(devLogChannelId)) {
  console.error('[config] DEV_LOG_CHANNEL_ID must be a Fluxer channel id.');
  process.exit(1);
}
const turnstileSiteKey = optionalOrNull('TURNSTILE_SITE_KEY');
const turnstileSecretKey = optionalOrNull('TURNSTILE_SECRET_KEY');
const itadApiKey = optionalOrNull('ITAD_API_KEY');
const twitchClientId = optionalOrNull('TWITCH_CLIENT_ID');
const twitchClientSecret = optionalOrNull('TWITCH_CLIENT_SECRET');
const kickClientId = optionalOrNull('KICK_CLIENT_ID');
const kickClientSecret = optionalOrNull('KICK_CLIENT_SECRET');
// Signs session cookies and short-lived tokens (e.g. verification links), so it
// must always exist. When unset we generate one; that only matters for
// persistence when the dashboard login is enabled.
let sessionSecret = optionalOrNull('SESSION_SECRET');
if (!sessionSecret) {
  sessionSecret = randomBytes(32).toString('hex');
  if (fluxerClientSecret) {
    console.warn(
      '[config] SESSION_SECRET is not set — generated a random one. ' +
        'Dashboard sessions will not survive a restart until you pin SESSION_SECRET.'
    );
  }
}

export const config = Object.freeze({
  // Fluxer
  fluxerToken: required('FLUXER_TOKEN'),
  fluxerClientId: required('FLUXER_CLIENT_ID'),
  // Internal gateway sharding for this one process. 'auto' | positive integer.
  fluxerShardCount,
  // Instance overrides (null = hosted Fluxer) and timestamp rendering.
  fluxerApiUrl,
  fluxerWebUrl,
  fluxerTimestamps,

  // Web dashboard
  webPort,
  // Public base URL of the dashboard, used to build the OAuth2 redirect URI.
  // When null it is derived per-request (fine for direct access; set this
  // behind a reverse proxy).
  dashboardUrl: optionalOrNull('DASHBOARD_URL')?.replace(/\/+$/, '') ?? null,

  // Dashboard auth (see above)
  authEnabled: Boolean(fluxerClientSecret),
  fluxerClientSecret,
  sessionSecret,
  ownerIds,
  devLogChannelId,

  // Cloudflare Turnstile — powers the Verification module's captcha mode. When
  // both are unset, captcha mode falls back to a plain button.
  turnstileSiteKey,
  turnstileSecretKey,
  turnstileEnabled: Boolean(turnstileSiteKey && turnstileSecretKey),

  // IsThereAnyDeal API key — broadens the Free games module beyond Epic. Free
  // key from isthereanydeal.com/apps. When unset, Free games is Epic-only.
  itadApiKey,
  itadEnabled: Boolean(itadApiKey),

  // Twitch API app credentials — power the Twitch alerts module. Free app at
  // dev.twitch.tv/console. When unset, the module's poll loop no-ops.
  twitchClientId,
  twitchClientSecret,
  twitchEnabled: Boolean(twitchClientId && twitchClientSecret),

  // Kick API app credentials — power the Kick alerts module. Free app under
  // kick.com/settings/developer. When unset, the module's poll loop no-ops.
  kickClientId,
  kickClientSecret,
  kickEnabled: Boolean(kickClientId && kickClientSecret),

  // Game stats
  gametoolsApiBase: optional('GAMETOOLS_API_BASE', 'https://api.gametools.network').replace(/\/+$/, ''),
  cacheTtlMinutes,
  cacheTtlMs: cacheTtlMinutes * 60 * 1000,

  // Persistence
  databasePath: optional('DATABASE_PATH', './data/sylo.db'),
  databaseUrl,
  // Database backups. backupDir null => <db dir>/backups. intervalHours 0 =>
  // scheduled backup off. retention = how many snapshots to keep.
  backupDir: optionalOrNull('BACKUP_DIR'),
  backupIntervalHours,
  backupRetention,
  // Off-site backup targets. Any/all/none; a gzipped copy of each snapshot is
  // pushed to whatever is set (best-effort, logged).
  backupWebdavUrl,
  backupWebdavUser,
  backupWebdavPass,
  backupWebhookUrl,

  // Misc
  nodeEnv: optional('NODE_ENV', 'development'),
});
