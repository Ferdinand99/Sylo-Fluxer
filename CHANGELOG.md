# Changelog

Sylo-Fluxer is a port of [Sylo](https://github.com/Ferdinand99/Sylo) (a Discord
bot) to [Fluxer](https://fluxer.app). Its history starts at 0.1.0 — the port
itself; Sylo's own changelog up to 3.38.0 lives in the Sylo repository.

## [0.1.2](https://github.com/Ferdinand99/Sylo-Fluxer/compare/v0.1.1...v0.1.2) (2026-09-28)


### Features

* show the V2 dashboard link in open mode ([#10](https://github.com/Ferdinand99/Sylo-Fluxer/issues/10)) ([1ba6bec](https://github.com/Ferdinand99/Sylo-Fluxer/commit/1ba6bec6002fbaef06e5b8cd3906ba38a0280289))


### Bug Fixes

* accept @-prefixed user ids in the dashboard's member fields ([#13](https://github.com/Ferdinand99/Sylo-Fluxer/issues/13)) ([1baf19b](https://github.com/Ferdinand99/Sylo-Fluxer/commit/1baf19b83a67752809f26104573e177ba12efa74))
* keep temp voice channels when Fluxer refuses to move the member ([#8](https://github.com/Ferdinand99/Sylo-Fluxer/issues/8)) ([c3a633d](https://github.com/Ferdinand99/Sylo-Fluxer/commit/c3a633da24a927221c9143ab1ef2778d857f0500))

## [0.1.1](https://github.com/Ferdinand99/Sylo-Fluxer/compare/v0.1.0...v0.1.1) (2026-09-27)


### Bug Fixes

* fill in the guild on messages fetched over Fluxer's REST API ([#6](https://github.com/Ferdinand99/Sylo-Fluxer/issues/6)) ([c63083c](https://github.com/Ferdinand99/Sylo-Fluxer/commit/c63083c0d7ceca81fc9de1b9f7f9738b66cdc07f))

## 0.1.0 (2026-09-27)

### Features

* port Sylo to Fluxer: a platform layer over the Fluxer SDK (`@fluxerjs/core`),
  prefix commands (`!` by default, configurable per community with `!prefix`)
  generated from the existing command definitions, and reaction-based
  replacements for buttons and select menus (reaction roles, giveaways,
  verification, role choices on composed messages)

### Removed

* Discord-only features with no Fluxer equivalent: slash-command registration,
  native Discord AutoMod sync, thread / announcement / forum / stage channel
  types, and gateway intents
