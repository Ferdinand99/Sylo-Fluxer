# Temporary voice channels

Join-to-create voice hubs: a member joins a **hub** channel and Sylo spawns a
personal voice channel (and optional text channel) they own and control with
`!voice-*` commands, then sends them a DM with a link to join it. Empty channels
are cleaned up.

**Dashboard:** `/guilds/<id>/m/temp-voice`.

## Needs

- **Manage Channels**, and **Manage Roles** if you use role-based access.
- **Move Members** only for `!voice-kick` and `!voice-ban`, which disconnect
  someone from a temp channel.

## Settings (per hub)

- **Hub channel** + **category** for the spawned channels.
- **Name template** (`{index}`, `{username}`), **user limit**, **bitrate**.
- **Keep-alive minutes**, **ownership lock**, sync name/permissions from the
  category, and an allow/deny **role list** for who can join.

## Commands

Owner (or a voice moderator) controls: `!voice-rename`, `!voice-limit`,
`!voice-lock` / `!voice-unlock`, `!voice-hide` / `!voice-reveal`, `!voice-kick`,
`!voice-ban` / `!voice-unban`, `!voice-transfer`, `!voice-claim` (if the owner
left), `!voice-owner`. `!voice-clean` deletes all empty temp channels.

## Notes

- Up to 25 hubs per server.
- Sylo does not move members into their new channel. On Fluxer a move done by a
  bot drops the member's voice connection (they end up in the call without a
  registered voice state), so the member joins from the DM link instead. They
  be able to receive DMs from the bot; if they join the hub again while their
  channel exists, they get a link to the existing one. A channel nobody joins
  within two minutes is cleaned up like any other empty temp channel.
