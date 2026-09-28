<div align="center">

<img src="unraid/sylo.jpg" alt="Sylo-Fluxer" width="512" />

# Sylo-Fluxer

**A port of [Sylo](https://github.com/Ferdinand99/Sylo) — the multi-function bot with a MEE6-style web dashboard — to [Fluxer](https://fluxer.app). Self-host it with Docker.**

[![Status: beta](https://img.shields.io/badge/status-beta-orange)](#beta-status)
[![Built for Fluxer](https://img.shields.io/badge/built%20for-Fluxer-4641D9)](https://fluxer.app)
[![Test](https://github.com/Ferdinand99/Sylo-Fluxer/actions/workflows/test.yml/badge.svg)](https://github.com/Ferdinand99/Sylo-Fluxer/actions/workflows/test.yml)
[![Release](https://img.shields.io/github/v/release/Ferdinand99/Sylo-Fluxer?sort=semver&include_prereleases&label=release)](https://github.com/Ferdinand99/Sylo-Fluxer/releases)
[![GHCR](https://img.shields.io/badge/ghcr.io-ferdinand99%2Fsylo--fluxer-2496ED?logo=github&logoColor=white)](https://github.com/Ferdinand99/Sylo-Fluxer/pkgs/container/sylo-fluxer)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-5FA04E?logo=node.js&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/github/license/Ferdinand99/Sylo-Fluxer)](LICENSE)

</div>

> [!WARNING]
> **Sylo-Fluxer is in beta.** It runs on Fluxer and every module has been
> ported, but it started life as a Discord bot and several features do not work
> as expected yet. Read [Beta status](#beta-status) before you rely on it.

Sylo-Fluxer is Sylo rebuilt on the Fluxer SDK
([`@fluxerjs/core`](https://fluxer.js.org)): the same 34 per-community
**modules**, the same web dashboard, and the same data model — with commands
typed as `!help` instead of slash commands, and reactions in place of buttons
and menus, because Fluxer has neither. Everything runs in **one Node process,
one container**, with a single SQLite file for state.

Looking for the Discord bot? That's [Sylo](https://github.com/Ferdinand99/Sylo)
([sylobot.com](https://sylobot.com)). This repository is Fluxer only.

<details>
<summary>The 34 modules</summary>

moderation · logging · tickets · reaction roles · verification · welcome ·
welcome channel · birthdays · sticky messages · auto-moderation · honeypot ·
counting · custom commands · autoresponder · auto-react · reminders · leveling ·
AFK · server statistics · server insights · free games · ban appeals · temporary
voice channels · starboard · invite tracker · polls · giveaways · game stats ·
Twitch alerts · YouTube alerts · Kick alerts · RSS alerts · channel cleanup ·
GitHub alerts

</details>

## Contents

- [Beta status](#beta-status) · [How it differs from Sylo](#how-it-differs-from-sylo)
- [Commands](#commands) · [Features](#features)
- [Self-hosting](#self-hosting) · [Local development](#local-development)
- [Project structure](#project-structure) · [Releases & CI](#releases--ci) · [Tests](#tests)
- [Adding another game](#adding-another-game) · [Legal](#legal) · [License](#license)

## Beta status

What is known **not** to work as expected yet:

- **Dashboard login.** "Log in with Fluxer" is not finished — the OAuth code
  still points at Discord. Leave `FLUXER_CLIENT_SECRET` unset: the dashboard
  then runs in **open mode** (no login, full access for anyone who can reach it),
  so only expose it on `localhost` or a trusted LAN.
- **Discord wording.** Parts of the dashboard, the V2 dashboard and the docs
  under [`docs/`](docs/) still talk about Discord, slash commands and buttons.
  They're being rewritten.
- **Temporary voice channels and the server owner.** Fluxer never lets a bot
  move the community owner between voice channels, so the owner is sent a DM
  with a link to their new channel instead of being moved. Other members are
  moved as normal.
- **Timestamps.** Relative times in bot messages use the `<t:…>` markup; whether
  every Fluxer client renders it is not confirmed. Set `FLUXER_TIMESTAMPS=text`
  for plain UTC times if they show up raw.
- **Most modules haven't been exercised on Fluxer yet.** Verification, temporary
  voice channels and the dashboard have been checked on a live community; the
  commands and the other modules are covered by the test suite but not yet used
  for real.
- **The Fluxer SDK is young.** It's pinned to an exact version (`3.1.0`) and
  Fluxer's API still changes — expect the occasional fix after a Fluxer update.

Found something broken? [Open an issue](https://github.com/Ferdinand99/Sylo-Fluxer/issues).

## How it differs from Sylo

| | Sylo (Discord) | Sylo-Fluxer |
| --- | --- | --- |
| Commands | Slash commands (`/warn`) | Prefix commands (`!warn`), prefix configurable per community; mentioning the bot works too |
| Private replies | Ephemeral messages | Replied in the channel and deleted after 15 s, or sent by DM (`!mydata`, `!forget`, …) |
| Buttons & menus | Role buttons / selects, Verify button, giveaway Enter button, `/help` menu | Reactions (role reactions, ✅ to verify, 🎉 to enter), numbered replies, `!help <topic>` |
| Auto-moderation | Sylo's filters + optional sync to Discord's native AutoMod | Sylo's own filters only (Fluxer has no native AutoMod) |
| Channel types | Text, voice, announcement, forum, stage, threads | Text, voice and categories |
| Gateway intents | Server Members / Message Content toggles | None — Fluxer has no intents |
| Hosted instance | [sylobot.com](https://sylobot.com) | None yet — self-host only |

## Commands

Commands start with `!` by default. Change it per community with
`!prefix <new>` (needs Manage Server), or mention the bot instead of typing a
prefix. `!help` lists every command; `!help <command>` shows its usage.

Arguments go in order (`!warn add @member spamming the chat`), and the last
text argument takes the rest of the line. Typed arguments — members, channels,
roles, numbers, durations like `1d` — are recognised wherever they appear, so
`!ban @member 1d spam` and `!ban @member spam 1d` both work. Any argument can
also be given by name: `!ban @member delete_messages:1d`.

- **General** — `!help`, `!ping`, `!about`, `!version`, `!prefix`, `!stats`
  (Battlefield-series and RuneScape player lookups, with the Game stats module)
- **Moderation** — `!kick`, `!ban`, `!unban`, `!timeout`, `!untimeout`, `!purge`,
  `!slowmode`, `!lock`, `!unlock`, `!lockdown`, `!warn`, `!modlog`, and a numbered
  case log with `!history @member` and `!case view|reason|delete|note`
- **Community** — `!rank`, `!leaderboard`, `!afk`, `!birthday`, `!poll`,
  `!poll-end`, `!giveaway`, `!freegames`, `!invites`, `!inviter`,
  `!invites-leaderboard`
- **Temporary voice** — `!voice-claim`, `!voice-transfer`, `!voice-rename`,
  `!voice-limit`, `!voice-lock`, `!voice-unlock`, `!voice-hide`, `!voice-reveal`,
  `!voice-kick`, `!voice-ban`, `!voice-unban`, `!voice-owner`, `!voice-clean`
- **Privacy** — `!mydata` (DMs you a JSON copy of your data) and `!forget`
  (deletes it)

Moderation commands check the member's permissions when they're run. Every
command can be disabled or limited to channels / roles per community from the
dashboard.

## Features

- **Moderation** — warning thresholds that auto-timeout / kick / ban, a numbered
  case log, role-hierarchy checks, optional DM to the target, a ban manager.
- **Auto-moderation** — bad words, repeated text, invite links (Fluxer and
  Discord), links, caps, emojis, spoilers, mentions, zalgo and anti-spam, each
  Disabled / Delete / Delete + Warn / Delete + Timeout; immunity roles.
- **Honeypot** — trap channels and trap messages that instantly punish raid bots
  and scrapers.
- **Verification** — members react ✅ on the verify message to get a role, or
  pass a Cloudflare Turnstile captcha on the dashboard; optional auto-kick of
  members who don't verify.
- **Reaction roles & autoroles** — dashboard-built role messages; members react
  to pick roles (exclusive and reverse modes), and roles are given on join.
- **Welcome, welcome channel, birthdays, sticky messages, counting, AFK,
  autoresponder, auto-react, reminders** — as in Sylo.
- **Custom commands** — `!name` commands built from an ordered list of actions:
  reply (text or embed, or a random pick), post to another channel, add or
  remove a role; per-command role / channel limits and a cooldown.
- **Leveling** — XP for messages and time in voice, multipliers, level-up
  announcements, role rewards, rank and leaderboard image cards, and a public
  web leaderboard.
- **Tickets (modmail)** — members DM the bot; staff read and answer from the
  dashboard.
- **Temporary voice channels** — "join to create" hubs with name templates,
  limits, permission sync, role gating and an optional text channel, controlled
  with the `!voice-*` commands.
- **Starboard, polls, giveaways, invite tracker, server statistics, server
  insights, ban appeals, channel cleanup.**
- **Alerts** — Twitch, YouTube, Kick, RSS / Atom (plus Reddit, Mastodon and
  Bluesky), free games (Epic, plus more stores with an IsThereAnyDeal key) and
  GitHub webhooks.
- **Web dashboard** — Express + EJS with htmx and Alpine (no build step): a
  plugin grid, a settings panel per module, a Bot Personalizer, an embed builder,
  an audit log and a Health page. A new React dashboard (**V2**, beta) lives at
  `/v2`.
- **Operations** — `GET /health` (JSON), `GET /metrics` (Prometheus), automatic
  SQLite snapshots with download / import / restore from the Health page,
  optional off-site copies (WebDAV and/or a webhook), a dev-log channel for the
  bot's own errors (`DEV_LOG_CHANNEL_ID`), and automatic removal of a
  community's data when the bot leaves it.

## Self-hosting

### 1. Create the Fluxer application

In the Fluxer app open **User Settings → Developer → Applications** and create
an application. You need:

| Variable | Where |
| --- | --- |
| `FLUXER_TOKEN` | *Secrets & tokens* → Bot token |
| `FLUXER_CLIENT_ID` | *Application ID*, at the top of the page |

Invite the bot to your community with (replace the id):

```
https://web.fluxer.app/oauth2/authorize?client_id=YOUR_APPLICATION_ID&scope=bot&permissions=1100469103831
```

That permission set covers moderation, roles, channels, messages, moving
members and timeouts. Put the bot's role **above** the roles it should manage.

Every other variable is optional — see [`.env.example`](.env.example). A
self-hosted Fluxer instance is supported via `FLUXER_API_URL` /
`FLUXER_WEB_URL`.

### 2. Run it

With Docker Compose:

```bash
cp .env.example .env      # set FLUXER_TOKEN and FLUXER_CLIENT_ID
docker compose up -d --build
```

The dashboard listens on port 3000. It runs in **open mode** (no login) — see
[Beta status](#beta-status) — so keep it on `localhost` or a trusted LAN.

Or run the prebuilt multi-arch image (`linux/amd64` + `linux/arm64`) with the
same `.env` and a volume for `/app/data`:

| Tag | What it is |
| --- | --- |
| `ghcr.io/ferdinand99/sylo-fluxer:latest`, `:X.Y.Z`, `:X.Y` | Releases |
| `ghcr.io/ferdinand99/sylo-fluxer:main`, `:sha-<short>` | Rolling build of `main` |

### Unraid

Sylo-Fluxer is not in Community Applications yet. Add the template by URL
(**Docker → Template repositories**):
`https://raw.githubusercontent.com/Ferdinand99/Sylo-Fluxer/main/unraid/sylo.xml`.
Keep the data directory on a real local disk (e.g. `/mnt/cache/appdata/sylo-fluxer`),
not `/mnt/user` — SQLite in WAL mode needs working file locks. If you also run
the Discord Sylo on the same server, the template already uses different names,
paths and ports.

The longer guide in [docs/self-hosting.md](docs/self-hosting.md) — reverse proxy,
backups, upgrades, troubleshooting — is inherited from Sylo and still written
for Discord; the operational parts apply unchanged.

## Local development

Requires **Node.js 22+** and a Fluxer application (see above).

```bash
git clone https://github.com/Ferdinand99/Sylo-Fluxer.git
cd Sylo-Fluxer
npm install
cp .env.example .env     # set FLUXER_TOKEN and FLUXER_CLIENT_ID
npm test
npm run dev              # restarts on file changes
```

Only one process may use a bot token at a time — stop any other instance first,
or the bot answers every command twice.

## Project structure

```
src/
  index.js              Entrypoint — boots DB, bot and web in one process
  config.js             Loads / validates env vars
  runtime.js            Shared in-memory state (uptime, errors, client)
  platform/             Everything Fluxer-specific in one place:
    compat.js             discord.js-shaped aliases over the Fluxer SDK (+ REST fixes)
    voiceStates.js        voice-state tracking (the SDK keeps none)
    channels.js           fetch / create / delete guild channels
    channelTypes.js permissions.js urls.js time.js mentions.js snowflake.js
  bot/
    index.js            Fluxer client bootstrap
    framework/          prefix commands: CommandBuilder, parser, resolve,
                        MessageInteraction (interaction-shaped adapter), router, usage
    commands/           one file per command (`data` + `execute`)
    events/             ready, messageCreate (router), moduleEvents (gateway → modules),
                        dmTickets (DM → ticket), guildCreate, guildDelete (purge on leave)
    lib/ embeds/        moderation, modlog, custom commands, cards, embeds
  modules/              registry, dispatch, and one file per module
  adapters/games/       game-stats adapters (Battlefield, RuneScape)
  db/                   SQLite (or Postgres) access + migrations, one file per table group
  web/                  Express app: routes, middleware, views (EJS), public assets
web-v2/                 the V2 dashboard (React + Vite), served at /v2
test/                   node --test suite
```

## Releases & CI

- `test.yml` — lint, the test suite against SQLite **and** Postgres, a syntax
  check and an EJS compile check. Gates every image build.
- `docker-publish.yml` — every push to `main` publishes
  `ghcr.io/ferdinand99/sylo-fluxer:main` and `:sha-<short>`; pull requests only
  build.
- `release-please.yml` — keeps a release PR open from
  [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`,
  …). Merging it tags `vX.Y.Z`, writes the GitHub Release and
  [CHANGELOG.md](CHANGELOG.md), and publishes `:latest`, `:X.Y.Z` and `:X.Y` to
  GHCR.

All publishing uses the built-in `GITHUB_TOKEN`; no secrets are needed.
release-please reads commit messages on `main`, so when squash-merging a pull
request, make sure the commit message is the Conventional-Commit PR title.

## Tests

```bash
npm test                 # SQLite
DATABASE_URL=postgres://user:pass@host:5432/db npm test   # + the Postgres tests
```

The `node:test` suite covers the prefix-command parser and router, the Fluxer
compatibility layer, module logic, every database table on both drivers, and
the dashboard over HTTP. No network: external APIs are stubbed and DB tests use
a throwaway database.

## Adding another game

1. Create `src/adapters/games/<game>.js` exporting an adapter with `id`,
   `titles()`, `platformsFor(title)` and `getPlayerStats(username, platform, { title })`
   — throw the typed errors from `gameAdapter.js` for failures.
2. Register it in `src/adapters/games/index.js`.
3. Add a `game` choice (`<adapter>:<title>`) to `GAME_CHOICES` in
   `src/bot/commands/stats.js`, and an embed builder if the stats differ.

## Legal

The [privacy policy](docs/privacy-policy.md) and
[terms of service](docs/terms-of-service.md) in this repository are inherited
from Sylo and describe the Discord instances; they haven't been adapted to
Sylo-Fluxer yet. If you run your own instance you are its operator — publish
your own.

## License

MIT © Ferdinand99. Sylo-Fluxer is a port of [Sylo](https://github.com/Ferdinand99/Sylo).
