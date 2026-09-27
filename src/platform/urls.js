// URLs that point at Fluxer itself: API, web app (OAuth, jump links, bot
// invite) and CDN. Defaults are hosted Fluxer's published endpoints
// (https://fluxer.app/.well-known/fluxer); FLUXER_API_URL / FLUXER_WEB_URL
// point Sylo at a self-hosted instance instead.
import { DEFAULT_INSTANCE_ENDPOINTS, cdnDisplayAvatarURL } from '@fluxerjs/core';
import { config } from '../config.js';

export const API_ORIGIN = config.fluxerApiUrl ?? DEFAULT_INSTANCE_ENDPOINTS.api_public;
export const WEB_ORIGIN = config.fluxerWebUrl ?? DEFAULT_INSTANCE_ENDPOINTS.webapp;

/** Versioned REST base for raw calls (OAuth token exchange, /users/@me). */
export const API_BASE = `${API_ORIGIN}/v1`;

/** Client options for `new Client()` — only set when pointing at a self-hosted instance. */
export function clientInstanceOptions() {
  if (!config.fluxerApiUrl && !config.fluxerWebUrl) return {};
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
  return cdnDisplayAvatarURL(userId, avatarHash ?? null, { size });
}
