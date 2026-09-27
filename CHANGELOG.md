# Changelog

Sylo-Fluxer is a port of [Sylo](https://github.com/Ferdinand99/Sylo) (a Discord
bot) to [Fluxer](https://fluxer.app). Its history starts at 0.1.0 — the port
itself; Sylo's own changelog up to 3.38.0 lives in the Sylo repository.

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
