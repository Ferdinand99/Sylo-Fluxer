// URLs that point at Fluxer itself: API, web app (OAuth, jump links, bot
// invite) and CDN. Defaults are hosted Fluxer's published endpoints
// (https://fluxer.app/.well-known/fluxer); FLUXER_API_URL / FLUXER_WEB_URL
// point Sylo at a self-hosted instance instead.
import {
  DEFAULT_INSTANCE_ENDPOINTS,
  cdnDisplayAvatarURL,
  instanceDiscoveryUrl,
  parseInstanceDiscovery,
} from '@fluxerjs/core';
import { config } from '../config.js';

export const API_ORIGIN = config.fluxerApiUrl ?? DEFAULT_INSTANCE_ENDPOINTS.api_public;
export const WEB_ORIGIN = config.fluxerWebUrl ?? DEFAULT_INSTANCE_ENDPOINTS.webapp;

/** Versioned REST base for raw calls (OAuth token exchange, /users/@me). */
export const API_BASE = `${API_ORIGIN}/v1`;

const selfHosted = () => Boolean(config.fluxerApiUrl || config.fluxerWebUrl);

// A self-hosted instance's discovery document (raw), once loaded. It carries
// every endpoint — media, static CDN, gateway, invite — not just the two
// origins Sylo is configured with.
let discovery = null;

/**
 * Fetch the instance's /.well-known/fluxer so the client and avatar URLs use
 * its own media / CDN hosts. A no-op on hosted Fluxer. Throws when the
 * document can't be loaded; the caller logs it and falls back to the partial
 * endpoints, whose media / CDN hosts are hosted Fluxer's.
 * @param {typeof fetch} [fetchImpl]
 */
export async function loadInstanceDiscovery(fetchImpl = fetch) {
  if (!selfHosted()) return null;
  const url = instanceDiscoveryUrl(API_ORIGIN);
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${url} answered HTTP ${res.status}`);
  const raw = await res.json();
  parseInstanceDiscovery(raw); // validates; throws on a malformed document
  discovery = raw;
  return discovery;
}

/** The instance's endpoints: discovered, else hosted Fluxer's defaults. */
export const instanceEndpoints = () => discovery?.endpoints ?? DEFAULT_INSTANCE_ENDPOINTS;

/** Client options for `new Client()` — only set when pointing at a self-hosted instance. */
export function clientInstanceOptions() {
  if (!selfHosted()) return {};
  if (discovery) return { instance: discovery };
  return { instance: { api_public: API_ORIGIN, webapp: WEB_ORIGIN } };
}

/** OAuth2 authorize page (user login and bot invite both go through it). */
export const OAUTH_AUTHORIZE_URL = `${WEB_ORIGIN}/oauth2/authorize`;
export const OAUTH_TOKEN_URL = `${API_BASE}/oauth2/token`;

/**
 * Link that opens a message (or a channel when messageId is omitted) in the web app.
 * @param {string} guildId
 * @param {string} channelId
 * @param {string} [messageId]
 */
export function messageUrl(guildId, channelId, messageId) {
  const base = `${WEB_ORIGIN}/channels/${guildId}/${channelId}`;
  return messageId ? `${base}/${messageId}` : base;
}

/**
 * Avatar URL from raw API fields (dashboard session users, open-mode admin).
 * @param {string} userId
 * @param {string | null} avatarHash
 * @param {number} [size]
 */
export function avatarUrl(userId, avatarHash, size = 64) {
  const { media, static_cdn } = instanceEndpoints();
  return cdnDisplayAvatarURL(userId, avatarHash ?? null, {
    size,
    mediaBase: media,
    staticCdnBase: static_cdn,
  });
}
