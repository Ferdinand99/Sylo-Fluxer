# Custom commands

Build your own `!commands` from an ordered list of actions.

**Dashboard:** `/guilds/<id>/m/custom-commands`.

## Needs

- **Send Messages** / **Embed Links** for reply and post actions.
- **Manage Roles** (above the target roles) for add/remove-role actions.

## Settings (per command)

- **Name** — `a-z0-9_-`, max 32; members run it as `!name` (or with the
  server's own prefix). It can't clash with a built-in command or alias.
- **Description** — a note for your own reference on the dashboard.
- **Actions** — an ordered list, run in order:
  - **Reply** with text or an embed. A *private* reply is deleted again after
    15 seconds, together with the command message (Fluxer has no ephemeral
    messages).
  - **Send** a message to a channel.
  - **Add role** / **Remove role** to the invoking member.
- **Allowed roles / channels** and a per-user **cooldown**.

## Notes

- Changes apply as soon as you save; there is nothing to register or sync.
- `{args}` is replaced with whatever the member typed after the command name.
