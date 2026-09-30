# YouTube alerts

Announce a YouTube channel's new uploads, and when it goes live.

**Dashboard:** `/guilds/<id>/m/youtube-alerts`.

## Needs

- **Send Messages**, **Embed Links** in the alert channels.

## Settings

- **Alerts** — a list of `{ YouTube channel id (UC…), name, Fluxer channel,
  optional ping role, on-video / on-live toggles, video message, live message }`.
  Up to 50.
- Message placeholders: `{name}` `{title}` `{url}`.
- **When a livestream ends** — *Delete the message* (default), *Mark it as
  ended*, or *Leave it*. Applies only to the "went live" post; new-video
  announcements are never touched.

## Notes

- Find the `UC…` id via the channel's *About → Share → Copy channel ID*.
- Uploads and live states are de-duplicated so each posts once.
