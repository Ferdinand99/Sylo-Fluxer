# Self-hosting Sylo-Fluxer

Everything needed to run your own instance: install, configuration, a reverse
proxy, upgrades and rollback, and a troubleshooting table. For what each feature
does, see [`docs/modules/`](modules/README.md).

Sylo-Fluxer is a single Node 22 process — the Fluxer bot and the web dashboard
in one. No build step. All state is one SQLite file under a mounted data
directory by default — that's the right choice for nearly everyone; see
[docs/postgres.md](postgres.md) if you're running at hosted scale and want the
optional Postgres backend instead.

- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Fluxer application setup](#fluxer-application-setup)
- [A self-hosted Fluxer instance](#a-self-hosted-fluxer-instance)
- [Dashboard authentication](#dashboard-authentication)
- [Behind a reverse proxy](#behind-a-reverse-proxy)
- [Docker](#docker)
- [Unraid](#unraid)
- [Backups](#backups)
- [Upgrades and rollback](#upgrades-and-rollback)
- [SQLite on a network mount](#sqlite-on-a-network-mount)
- [Troubleshooting](#troubleshooting)

---

## Quick start

```bash
git clone https://github.com/Ferdinand99/Sylo-Fluxer.git
cd Sylo-Fluxer
npm install
cp .env.example .env        # fill in FLUXER_TOKEN and FLUXER_CLIENT_ID
npm start
```

Or with Docker:

```bash
cp .env.example .env
docker compose up -d --build
docker compose logs -f sylo-fluxer
```

The dashboard is then on `http://<host>:${WEB_PORT:-3000}` and the database
persists in `./data`.

Commands are typed in chat with a prefix — `!` by default, changeable per
server with `!prefix` or on the dashboard. Mentioning the bot works too
(`@Sylo help`). There is nothing to register: new and changed commands work as
soon as the process restarts.

---

## Environment variables

Only `FLUXER_TOKEN` and `FLUXER_CLIENT_ID` are required.
[`.env.example`](../.env.example) lists them all with comments.

| Variable                  | Default                         | Description |
|---------------------------|---------------------------------|-------------|
| `FLUXER_TOKEN`            | —                               | Bot token (**required**) |
| `FLUXER_CLIENT_ID`        | —                               | Application id (**required**) |
| `FLUXER_SHARD_COUNT`      | `auto`                          | Internal gateway shards for this one process. `auto` stays at 1 below ~2,500 communities; pin an integer to override. Multi-process sharding is not supported. |
| `FLUXER_API_URL`          | hosted Fluxer                   | A self-hosted instance's public API origin, e.g. `https://chat.example.com/api` — see [below](#a-self-hosted-fluxer-instance) |
| `FLUXER_WEB_URL`          | hosted Fluxer                   | That instance's web app origin, e.g. `https://chat.example.com` |
| `FLUXER_TIMESTAMPS`       | `native`                        | `native` (`<t:…>` markup, shown in each reader's timezone) or `text` (a plain UTC string) |
| `WEB_PORT`                | `3000`                          | Dashboard HTTP port |
| `FLUXER_CLIENT_SECRET`    | —                               | Set to require "Log in with Fluxer" on the dashboard |
| `SESSION_SECRET`          | random                          | Signs the session cookie; pin it so logins survive restarts |
| `OWNER_IDS`               | —                               | Your Fluxer user id(s), comma/space-separated. Gates `/health` to just these accounts when `FLUXER_CLIENT_SECRET` is set — everyone else is blocked, not just non-admins |
| `DEV_LOG_CHANNEL_ID`      | —                               | A channel id Sylo posts its own errors to — a "dev-log", separate from any per-server logging/modlog channel. Optional |
| `DASHBOARD_URL`           | derived                         | Public dashboard URL; needed behind a reverse proxy and for verification-captcha / ban-appeal links |
| `TURNSTILE_SITE_KEY`      | —                               | Cloudflare Turnstile site key — enables the Verification captcha mode |
| `TURNSTILE_SECRET_KEY`    | —                               | Cloudflare Turnstile secret key (pair with the site key) |
| `ITAD_API_KEY`            | —                               | IsThereAnyDeal key — adds non-Epic stores to the Free games module |
| `TWITCH_CLIENT_ID` / `_SECRET` | —                          | Twitch app credentials for the Twitch alerts module |
| `KICK_CLIENT_ID` / `_SECRET`   | —                          | Kick app credentials for the Kick alerts module |
| `GAMETOOLS_API_BASE`      | `https://api.gametools.network` | Stats API base URL |
| `STATS_CACHE_TTL_MINUTES` | `5`                             | How long stats lookups are cached |
| `DATABASE_PATH`           | `./data/sylo.db`                | SQLite file path |
| `DATABASE_URL`            | —                               | Optional: a `postgres://` URL to use Postgres instead of SQLite. Hosted-scale deployments only — see [docs/postgres.md](postgres.md) |
| `BACKUP_INTERVAL_HOURS`   | `24`                            | Scheduled DB snapshot interval; `0` disables it (pre-migration + manual still run) |
| `BACKUP_RETENTION`        | `14`                            | How many DB snapshots to keep in `<data>/backups` |
| `BACKUP_DIR`              | `<db dir>/backups`              | Where DB snapshots are written |
| `LOG_LEVEL`               | `info`                          | `debug` / `info` / `warn` / `error` |
| `LOG_FORMAT`              | `text`                          | `text` or `json` |
| `NODE_ENV`                | `development`                   | Set to `production` in deployment |
| `TZ`                      | system                          | Timezone for transcript timestamps (IANA name) |

Fluxer has no gateway intents, so there is nothing to enable for modules that
read members or message content.

---

## Fluxer application setup

1. In the Fluxer app open **User Settings → Developer → Applications** and
   create an application.
2. *Secrets & tokens* → **Bot token** → copy into `FLUXER_TOKEN`.
3. Copy the **Application ID** at the top of the page into `FLUXER_CLIENT_ID`.
4. Invite the bot — the dashboard header has an **Invite** link once Sylo is
   running, or open (replace the id):

   ```
   https://web.fluxer.app/oauth2/authorize?client_id=YOUR_APPLICATION_ID&scope=bot&permissions=1100469103831
   ```

   That permission set covers:
   - **View Channel**, **Send Messages**, **Embed Links**, **Add Reactions**,
     **Read Message History** — always
   - **Attach Files** — welcome images, rank cards, leaderboard cards
   - **Kick Members**, **Ban Members**, **Moderate Members**, **Manage Messages**,
     **View Audit Log** — moderation and logging
   - **Manage Channels** — `!lock`, `!lockdown`, `!slowmode`, temporary voice, server statistics
   - **Manage Roles** — reaction roles, autoroles, verification, leveling rewards, birthday role
   - **Manage Nicknames** — AFK
   - **Connect** — temporary voice channels; **Move Members** — `!voice-kick` and `!voice-ban` in them (Sylo does not move members into their new channel)
   - **Create Invite** — personal `!invites` links
   - **Manage Webhooks** — requested, but no current module uses it

   Not included: **Manage Server**. Give Sylo's role that permission by hand if
   you use the invite tracker (it reads the community's invite list).
5. Drag **Sylo's role above the roles it should manage** in the community's
   role settings. The bot can never kick/ban/timeout someone whose highest role
   sits above its own, or edit a role above its own.

Tickets (modmail) and DM replies need members to allow DMs from community bots
(*User Settings → Privacy → Friends & direct messages*).

---

## A self-hosted Fluxer instance

Sylo talks to hosted Fluxer (fluxer.app) by default. To run it against your own
Fluxer instance instead:

1. Create the application and bot **on that instance** — a token from
   fluxer.app doesn't work anywhere else, and vice versa.
2. Set both origins:

   ```env
   FLUXER_API_URL=https://chat.example.com/api
   FLUXER_WEB_URL=https://chat.example.com
   ```

3. Use `https://chat.example.com/oauth2/authorize?…` for the invite link and
   add the dashboard's redirect URI in the application on that instance.

At startup Sylo reads the instance's `/.well-known/fluxer` and takes its media,
CDN, gateway and invite hosts from there, so avatars, emojis and invite links
point at the instance. If that document can't be loaded, a warning is logged and
Sylo starts with hosted Fluxer's CDN for images.

---

## Dashboard authentication

By default the dashboard runs **open** (no login) — only safe on `localhost` or
a trusted LAN. Even in open mode a same-origin check blocks cross-site form
posts.

To require a login:

1. Your Fluxer application → *Secrets & tokens* → copy the **Client secret**
   into `FLUXER_CLIENT_SECRET`.
2. Add a **Redirect URI**: `<DASHBOARD_URL>/auth/fluxer/callback` (e.g.
   `http://192.168.1.10:3000/auth/fluxer/callback`, or the public HTTPS URL
   behind a proxy). It must match exactly.
3. Set a long random `SESSION_SECRET` (`openssl rand -hex 32`).
4. Set `OWNER_IDS` to your own Fluxer user id — without it, `/health` (status,
   error log, database backup/restore) is reachable by no one, not even you.

With `FLUXER_CLIENT_SECRET` set, every page except the `/health` JSON and the
`/metrics` scrape endpoint requires "Log in with Fluxer". Per-server pages
require **Manage Server** (or Administrator / owner) in that server, or one of
the **bot-master roles** set on that server's *Settings* page.

`/health` (JSON) and `/metrics` stay unauthenticated so a monitor or Prometheus
can reach them — keep them on your LAN, or restrict them at the reverse proxy if
the dashboard is public.

Point Prometheus at `<host>:<WEB_PORT>/metrics` and import
`docs/grafana-dashboard.json` for a ready-made overview (gateway health, guild
count, HTTP and command rates, DB size, module adoption).

### Off-site backups

Every local snapshot can also be shipped, gzipped, to a remote target — set any
of `BACKUP_WEBDAV_URL` (+ `BACKUP_WEBDAV_USER` / `BACKUP_WEBDAV_PASS`, e.g. a
Nextcloud folder) or `BACKUP_WEBHOOK_URL` (a webhook that accepts file uploads;
attachments over ~8 MiB are skipped). Uploads are best-effort and logged; they
never hold up the local backup. The Health page shows which targets are active.

---

## Behind a reverse proxy

Set `DASHBOARD_URL` to the public URL and proxy to `127.0.0.1:${WEB_PORT}`. Sylo
then trusts one proxy hop (`X-Forwarded-*`), which it needs for correct client
IPs (rate limiting) and OAuth redirects. Make sure the **Redirect URI** in your
Fluxer application matches `<DASHBOARD_URL>/auth/fluxer/callback`.

**Caddy**

```caddy
sylo.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

**nginx**

```nginx
server {
    listen 443 ssl;
    server_name sylo.example.com;
    # ssl_certificate ... ;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```env
DASHBOARD_URL=https://sylo.example.com
```

---

## Docker

The bundled `docker-compose.yml` builds from source, mounts `./data`, and sets a
restart policy (needed so a dashboard **Restore** can restart the container).

```bash
cp .env.example .env
docker compose up -d --build
```

### Prebuilt images

CI publishes multi-arch (`linux/amd64` + `linux/arm64`) images to GHCR:

| Tag | What it is |
| --- | --- |
| `ghcr.io/ferdinand99/sylo-fluxer:latest`, `:X.Y.Z`, `:X.Y` | Stable releases. What the Unraid template pulls. |
| `ghcr.io/ferdinand99/sylo-fluxer:main`, `:sha-<short>` | Rolling build of `main` — every push. |

```bash
docker run -d --name sylo-fluxer -p 3000:3000 --env-file .env \
  -v "$PWD/data:/app/data" --restart unless-stopped ghcr.io/ferdinand99/sylo-fluxer:latest
```

If `better-sqlite3` ever fails to build on Alpine for your platform, change the
two `FROM node:22-alpine` lines in the `Dockerfile` to `node:22-slim`.

---

## Unraid

The template lives in
[Ferdinand99/unraid-templates](https://github.com/Ferdinand99/unraid-templates).
Search for **Sylo-Fluxer** in **Apps** (Community Applications); until it's
listed there, add `https://github.com/Ferdinand99/unraid-templates` under
**Docker → Template repositories** and pick it from **Add Container**.

Manual container setup (Docker tab → Add Container):

| Field | Value |
|---|---|
| Repository | `ghcr.io/ferdinand99/sylo-fluxer:latest` |
| Network | `bridge` |
| Port | Container `3000` → a free host port |
| Path | Container `/app/data` → a real local path (see the caveat below) |
| Variable | `FLUXER_TOKEN`, `FLUXER_CLIENT_ID`, `NODE_ENV=production` |

If you also run the Discord Sylo on the same server, give Sylo-Fluxer its own
container name, host port and data path.

The image starts as root only long enough to fix ownership of the data
directory, then runs as an unprivileged user (`sylo`, uid 100). A fresh
root-owned folder works out of the box. If you still see `SQLITE_CANTOPEN`, run
once: `chown -R 100:101 <data path>`.

---

## SQLite on a network mount

**Put the data directory on a real local disk**, not a network share.
`better-sqlite3` uses WAL mode, which needs working file locks and `mmap`. SMB,
NFS, Unraid's `/mnt/user` (shfs / FUSE) and some Docker-Desktop bind mounts don't
provide them reliably, and you get `SQLITE_IOERR`, `database is locked`, or
silent corruption.

- **Unraid:** use a cache-pool path such as `/mnt/cache/appdata/sylo-fluxer`, or
  a disk-share path like `/mnt/disk1/appdata/sylo-fluxer` — not `/mnt/user/...`.
- **NAS / remote:** run Sylo on the box that owns the disk, or use a local
  volume.

---

## Backups

All state is one SQLite file (`data/sylo.db` + `-wal` / `-shm` sidecars) —
this section assumes that default setup. Running with `DATABASE_URL` set
instead? See [docs/postgres.md](postgres.md#backups-and-restore-on-postgres)
— the same buttons and flow, `pg_dump`/`pg_restore` under the hood.

**Automatic snapshots** are written to `data/backups/`: one before any schema
migration, one shortly after start, and one every `BACKUP_INTERVAL_HOURS`
(default 24), keeping the newest `BACKUP_RETENTION` (default 14). Set
`BACKUP_INTERVAL_HOURS=0` to keep only the pre-migration and manual ones.

**From the dashboard Health page** you can create a snapshot now, import a `.db`
from another machine (validated: SQLite header, `integrity_check`, schema no
newer than this build), download any snapshot, and **Restore** — which takes a
`prerestore` snapshot, swaps the file, and exits so the container restarts on the
restored data (needs a restart policy).

**Manual restore:** stop the container, copy a snapshot over `data/sylo.db`
(delete the `-wal` / `-shm` sidecars first), start again. Migrations only ever
move the schema forward; Sylo runs a `quick_check` on boot and logs corruption.

Per-server module config can also be exported as JSON from **General → Backup**.

---

## Upgrades and rollback

**Upgrade (prebuilt image):**

```bash
docker compose pull        # or: docker pull ghcr.io/ferdinand99/sylo-fluxer:latest
docker compose up -d
```

**Upgrade (from source):**

```bash
git pull
npm install
# restart the process / container
```

On start, Sylo applies any new schema migrations inside a transaction, taking a
`sylo-premigrate-vN-*.db` snapshot first.

**Rollback:** pull the previous image tag (e.g.
`ghcr.io/ferdinand99/sylo-fluxer:0.1.2`), or `git checkout` the previous tag,
then restore the matching `sylo-premigrate-*` (or a dated) snapshot from
`data/backups/` over `data/sylo.db`. A newer database can't be opened by an
older build — the schema check refuses it — so always roll the database back
together with the code.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Gateway authentication failed (4004)` on start | The token is wrong, or it belongs to another Fluxer instance — a fluxer.app token doesn't work against a self-hosted instance (set `FLUXER_API_URL` / `FLUXER_WEB_URL`) and vice versa. |
| The bot doesn't answer commands | Check the prefix (`@Sylo prefix` shows it), and that the bot can **View Channel** and **Send Messages** there. Only one process may use a token at a time — a second copy makes commands run twice or not at all. |
| "Log in with Fluxer" loops / `redirect_uri` mismatch | The application's **Redirect URI** must exactly equal `<DASHBOARD_URL>/auth/fluxer/callback`, scheme and port included. |
| DMs from Sylo don't arrive (tickets, verification reply) | The member doesn't allow DMs from community bots (*User Settings → Privacy*). Sylo falls back to a short-lived mention in the channel where it can. |
| Avatars or emojis broken on a self-hosted instance | Sylo couldn't load the instance's `/.well-known/fluxer` at startup (a warning is logged). Check `FLUXER_API_URL`. |
| `SQLITE_CANTOPEN` | The data directory isn't writable by uid 100. `chown -R 100:101 <data path>`. |
| `SQLITE_IOERR`, `database is locked`, corruption | The database is on a network share. Move it to a local disk — see [SQLite on a network mount](#sqlite-on-a-network-mount). |
| `better-sqlite3` fails to build | Switch the `Dockerfile` base images to `node:22-slim`, or install `python3 make g++` for a from-source build. On Windows, use Node 22 (prebuilt binaries) or install the Visual Studio build tools. |
| Moderation says it can't act on a member | Sylo's highest role must sit above the target's, and it needs the relevant permission (Ban/Kick/Moderate Members). |
| Welcome image / rank card missing | The bot lacks **Attach Files** in that channel, or `@napi-rs/canvas` didn't load on this platform (a warning is logged; the text message still sends). |
| Dashboard shows "open mode — no auth" | `FLUXER_CLIENT_SECRET` isn't set. That's expected for LAN use; set it to require a login. |
