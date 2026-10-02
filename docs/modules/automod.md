# Auto-moderation

Scans new and edited messages and acts on the first rule that matches.
Administrators, the server owner, bot-master roles, and members with an
**immunity role** are always skipped. Sylo never acts on other bots.

**Dashboard:** `/guilds/<id>/moderation` → **Automod** tab.

## Needs

- **Manage Messages** to delete offending messages; **Moderate Members** for the
  timeout action.

## Rules

Each rule is toggled independently:

- **Bad words** — blocks any listed word or phrase.
- **Server invites** — blocks Fluxer invite links (`fluxer.gg/…`), and Discord
  invites too.
- **External links** — blocks URLs; list allowed domains to permit only those.
- **Repeated text** — mostly one repeated word or character.
- **Excessive caps** — mostly uppercase.
- **Excessive emojis / spoilers / mentions** — more than N in one message.
- **Zalgo** — combining-mark spam.

## Actions

- **Delete the message** — on/off.
- **Timeout** the author for N minutes.
- Every action is posted to the mod-log channel (set under *General*).

## Notes

- Fluxer has no built-in AutoMod, so every rule runs in Sylo's own scanner and
  only while Sylo is online. (The Discord version of Sylo could mirror some
  rules to Discord's native AutoMod; that option doesn't exist here.)
- Immunity roles are shared with the warning auto-actions. Set them under
  **Immunity roles** at the bottom of the Auto-moderation page in the V2
  dashboard, or on the Moderator page's **Admin** tab in the classic one.
