# Reaction roles & autoroles

Two features in one module:

- **Autoroles** — roles assigned automatically when a member joins.
- **Reaction roles** — a posted message members react to in order to
  self-assign roles. Removing the reaction removes the role.

**Dashboard:** `/guilds/<id>/m/roles`.

## Needs

- **Manage Roles**, with Sylo's role above every role it hands out.
- **Add Reactions** and **Read Message History** in the reaction-role channel.

## Settings

- **Autoroles** — a role list; also editable from the [Welcome](welcome.md)
  page's "Give roles to new members".
- **Reaction-role messages** — each has a channel, an embed, whether it's
  exclusive (one role at a time), and a list of role + label (+ emoji) pairs.
  A pair without an emoji gets a numbered one (1️⃣, 2️⃣, …).

## Notes

- Editing a reaction-role message edits it in place, or re-posts it if it was
  deleted. Sylo adds the reactions itself so members only have to click one.
- In an **exclusive** set, picking a role removes the member's other roles (and
  reactions) from that set. Removing the reaction there keeps the role, so a
  member always holds one.
- **Reverse** mode flips it: reacting removes the role, un-reacting gives it back.
- Fluxer has no buttons or select menus, so the Discord version's button and
  menu styles become reactions here.
- Managed roles (bot roles, etc.) can't be assigned and are dropped from the
  picker.
