# Contributing to Sylo-Fluxer

Thanks for taking a look. Sylo-Fluxer is a single Node.js process (Fluxer bot +
web dashboard) with SQLite persistence, run as a Docker container. It's a port of
the Discord bot [Sylo](https://github.com/Ferdinand99/Sylo), so much of the code
still reads like discord.js: `src/platform/compat.js` adds discord.js-style aliases
to the Fluxer SDK, and `src/bot/framework/` turns `!commands` into slash-command-shaped
interactions.

## Getting set up

```bash
npm install
cp .env.example .env      # add FLUXER_TOKEN + FLUXER_CLIENT_ID (a test bot)
npm start                 # or: npm run dev  (node --watch)
```

Commands are prefix commands (`!ping`); there is nothing to register, a restart
picks up new ones. Only one process may use a bot token at a time, so give your
dev copy its own test bot. Full setup: [docs/self-hosting.md](docs/self-hosting.md).

## Architecture

One process, no build step. Entry point `src/index.js` starts both halves:

| Area | Where |
|---|---|
| Fluxer client, command loader, event wiring | `src/bot/` |
| Commands (auto-discovered) | `src/bot/commands/*.js` — each exports `data` (a `SlashCommandBuilder` from `src/bot/framework/CommandBuilder.js`) + `execute` |
| Prefix-command parsing and routing | `src/bot/framework/` (`router.js`, `parser.js`, `MessageInteraction.js`) |
| Fluxer SDK compatibility aliases | `src/platform/` (`compat.js` — new code should use the native SDK) |
| Feature modules | `src/modules/<id>.js` — register with `on(moduleId, event, fn)` from `dispatch.js` |
| Module catalogue | `src/modules/registry.js` |
| SQLite connection + forward-only migrations | `src/db/index.js` (`MIGRATIONS` array) |
| Per-table data access | `src/db/<name>.js` — prepared statements |
| Guild / user data erasure | `src/db/purge.js` (`GUILD_TABLES`, `forgetUser`, `describeUserData`) |
| Express app + routes | `src/web/server.js`, `src/web/routes/` |
| EJS views + htmx/Alpine assets | `src/web/views/`, `src/web/public/` |

Per-module docs live in [docs/modules/](docs/modules/README.md) — add a page when
you add a module.

## Before opening a PR

- `npm test` — the suite must pass. It runs in CI and gates every image build.
- `npm run lint` and `npm run format:check` — ESLint + Prettier, also gated in CI.
- Add or update tests for behaviour you change. Pure helpers get unit tests;
  DB-touching tests import `test/helpers/tmpDb.js` first so they use a throwaway
  database.
- Keep to the existing style: ESM, no build step, no new runtime dependencies
  without discussion, hand-written CSS + htmx/Alpine in `src/web/public`.
- New per-guild storage goes in a migration in `src/db/index.js` (append only —
  migrations are forward-only and run automatically on boot).
- New guild-scoped tables must be added to `GUILD_TABLES` in `src/db/purge.js`
  (a test enforces this) so they are wiped when Sylo leaves a server. If the
  table keys on a user id, also handle it in `forgetUser` / `describeUserData`.

## Commits & releases

Use [Conventional Commits](https://www.conventionalcommits.org): `feat:`,
`fix:`, `refactor:`, `docs:`, `chore:`, and `feat!:` / `BREAKING CHANGE:` for a
major bump. Only `feat:` (minor) and `fix:` (patch) bump the version.
[release-please](https://github.com/googleapis/release-please) maintains the
release PR and `CHANGELOG.md` from commit subjects — one bullet per subject line,
so write them for a human reader.

## Adding a module

1. `src/modules/<id>.js` — register handlers with `on(moduleId, event, fn)` from
   `dispatch.js`, or start a `setInterval` for scheduled work (unref it).
2. Add it to `MODULES` in `src/modules/registry.js` and import it in
   `src/modules/index.js`.
3. If it stores per-guild config: add `src/web/views/guild/modules/<id>.ejs`,
   list the id in `CONFIG_VIEWS` in `src/web/routes/guilds.js`, and handle its
   config POST there.
4. Icon: add an entry to `MODULE_ICONS` in `src/web/lib/moduleIcons.js` and the
   matching `#i-<name>` SVG symbol in `src/web/views/partials/header.ejs`; add
   the module to a category in `src/web/lib/sidebarNav.js` and a card line in
   `src/web/lib/overviewSummary.js`.
5. If it stores per-guild rows, add the table to `GUILD_TABLES`; if user-scoped,
   to `forgetUser` / `describeUserData` too.
6. Write `docs/modules/<id>.md` and add it to `docs/modules/README.md`.
