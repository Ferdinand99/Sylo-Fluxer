# Server statistics

Keeps voice-channel names updated with live counts — total members, humans, bots,
a role's member count, or the boost count (always 0 on Fluxer, which has no boosts). MEE6-style "stat channels".

**Dashboard:** `/guilds/<id>/m/server-stats`.

## Needs

- **Manage Channels** (to rename), **Connect** on the stat channels (so they
  render), and ideally lock them so members can't join.

## Settings

- **Refresh interval** — minutes between updates (channel renames are rate-limited
  keep it generous — 10+ minutes).
- **Channels** — each maps a voice channel to a metric and a name template
  (e.g. `Members: {count}`).

## Notes

- Channel renames are rate-limited (Discord allowed about two per channel per 10 minutes); the module
  spaces updates accordingly.
