# Verification

Gate new members behind a ✅ reaction (or a Cloudflare Turnstile captcha) before
they get a role.

**Dashboard:** `/guilds/<id>/m/verification`.

## Needs

- **Manage Roles**, with Sylo's role above the verified role.
- **Add Reactions** and **Read Message History** in the verify channel.
- For captcha mode: `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`, and a reachable
  `DASHBOARD_URL` (the captcha page is served by Sylo).

## Settings

- **Mode** — `button` (react ✅) or `captcha`. Captcha falls back to the
  reaction when Turnstile isn't configured.
- **Verified role** — granted on success.
- **Verify channel / message** — where the verify message is posted. Its title
  and body accept `{server}`.
- **Reply after verifying** — sent by DM; accepts `{server}`, `{user}`,
  `{user.name}` and `{user.id}`.
- Optional: a log channel (pick a different channel from the verify channel),
  and kicking members who haven't verified after N minutes.

## How it works

A new member sees only the verify channel and reacts ✅ on the verify message.
Sylo removes the reaction again so the message stays clean. In reaction mode the
role is granted straight away; in captcha mode Sylo DMs a link to
`<DASHBOARD_URL>/verify/<token>`, which grants the role after the challenge
passes. Tokens expire after 15 minutes and are bound to the member + server.

If the member's DMs are closed, the reply is posted in the verify channel as a
mention instead and deleted after a minute.
