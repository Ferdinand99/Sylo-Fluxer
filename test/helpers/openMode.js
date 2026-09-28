// Import right after helpers/tmpDb.js and before anything that loads
// src/config.js. Forces the dashboard into "open mode" (no Discord OAuth, no
// session, CSRF middleware a no-op) so route tests aren't redirected to
// /auth/fluxer/login. Assigning "" (rather than delete) so `dotenv/config`,
// which never overrides an already-set key, can't repopulate it from a local
// .env file.
process.env.FLUXER_CLIENT_SECRET = '';
process.env.DASHBOARD_URL = '';
