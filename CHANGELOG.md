# Changelog

Sylo-Fluxer is a port of [Sylo](https://github.com/Ferdinand99/Sylo) (a Discord
bot) to [Fluxer](https://fluxer.app). Its history starts at 0.1.0 — the port
itself; Sylo's own changelog up to 3.38.0 lives in the Sylo repository.

## [0.1.5](https://github.com/Ferdinand99/Sylo-Fluxer/compare/v0.1.4...v0.1.5) (2026-10-02)


### Features

* refresh the V2 dashboard design and drop the roadmap board ([#37](https://github.com/Ferdinand99/Sylo-Fluxer/issues/37)) ([96c1b36](https://github.com/Ferdinand99/Sylo-Fluxer/commit/96c1b3608075c71a7fb88281fd0cee883a2cd373))
* V2 pages for commands, tickets, appeals and moderation ([#38](https://github.com/Ferdinand99/Sylo-Fluxer/issues/38)) ([fed35fd](https://github.com/Ferdinand99/Sylo-Fluxer/commit/fed35fd71e2c669d2b6efb54b0b69a5193b5e937))

## [0.1.4](https://github.com/Ferdinand99/Sylo-Fluxer/compare/v0.1.3...v0.1.4) (2026-10-01)


### Features

* emoji picker for auto-react rules ([#34](https://github.com/Ferdinand99/Sylo-Fluxer/issues/34)) ([c39016e](https://github.com/Ferdinand99/Sylo-Fluxer/commit/c39016ee7520044c4d94aae6207aacd716a0ce53))


### Bug Fixes

* birthday greetings crashed when a birthday role is set ([#29](https://github.com/Ferdinand99/Sylo-Fluxer/issues/29)) ([203608a](https://github.com/Ferdinand99/Sylo-Fluxer/commit/203608ae3f7f4900dd88551b25ff30b6dc82837e))
* clear reactions on the honeypot bait message ([#27](https://github.com/Ferdinand99/Sylo-Fluxer/issues/27)) ([465823a](https://github.com/Ferdinand99/Sylo-Fluxer/commit/465823a31e6faeff8ba281b03e4e1ba20c28f0ce))
* count members already in voice in server insights ([#35](https://github.com/Ferdinand99/Sylo-Fluxer/issues/35)) ([efffd3a](https://github.com/Ferdinand99/Sylo-Fluxer/commit/efffd3a12622c965e6ca6ae77083ad7a0dc8d98f))
* create the rejoin invite when a ban appeal is accepted ([#32](https://github.com/Ferdinand99/Sylo-Fluxer/issues/32)) ([f4bf683](https://github.com/Ferdinand99/Sylo-Fluxer/commit/f4bf683435b6ee571157e798581b6ce87a49b0fe))
* read !poll flags and durations right and show the poll end time ([#30](https://github.com/Ferdinand99/Sylo-Fluxer/issues/30)) ([ce92291](https://github.com/Ferdinand99/Sylo-Fluxer/commit/ce9229188bac1c8fd555f9a9464181678bcdfb59))
* send a join link instead of moving members into temp voice channels ([#36](https://github.com/Ferdinand99/Sylo-Fluxer/issues/36)) ([d640ccf](https://github.com/Ferdinand99/Sylo-Fluxer/commit/d640ccfdcaeaca1d0763c7558641d4905df734b3))
* show ties in poll results and drop the countdown once closed ([#31](https://github.com/Ferdinand99/Sylo-Fluxer/issues/31)) ([3ea85cf](https://github.com/Ferdinand99/Sylo-Fluxer/commit/3ea85cf1b8c73b3409df29d690e91b26aefafe12))
* welcome DMs and leave-message names ([#33](https://github.com/Ferdinand99/Sylo-Fluxer/issues/33)) ([80e7bf6](https://github.com/Ferdinand99/Sylo-Fluxer/commit/80e7bf69e9088558057347aa08397c3209ac19e9))

## [0.1.3](https://github.com/Ferdinand99/Sylo-Fluxer/compare/v0.1.2...v0.1.3) (2026-09-30)


### Bug Fixes

* accept multi-word choices like "Battlefield 6" and make purge and mention checks work on Fluxer ([#24](https://github.com/Ferdinand99/Sylo-Fluxer/issues/24)) ([ba6189f](https://github.com/Ferdinand99/Sylo-Fluxer/commit/ba6189f4f95ec6573246bc203576481ffddca4c8))
* add the discord.js permission getters Fluxer lacks (stats, delet… ([#17](https://github.com/Ferdinand99/Sylo-Fluxer/issues/17)) ([f079b61](https://github.com/Ferdinand99/Sylo-Fluxer/commit/f079b618b64c88bae5aa1ae2d23484b74808cbf0))
* don't clear AFK on the !afk command itself ([#23](https://github.com/Ferdinand99/Sylo-Fluxer/issues/23)) ([866c341](https://github.com/Ferdinand99/Sylo-Fluxer/commit/866c341a2261b0596eb4a080fd044584848be840))
* fill more discord.js gaps in the Fluxer compat layer (nicknames,… ([#19](https://github.com/Ferdinand99/Sylo-Fluxer/issues/19)) ([d39facf](https://github.com/Ferdinand99/Sylo-Fluxer/commit/d39facf08a58459afac411ade6997523a4ac8c5f))
* publish embeds with fields and show the builder's result banner ([#20](https://github.com/Ferdinand99/Sylo-Fluxer/issues/20)) ([c23fa78](https://github.com/Ferdinand99/Sylo-Fluxer/commit/c23fa78da271d57c2f05c9c25934af75b13daaa1))
* purge counts back from the command and replies survive a deleted… ([#25](https://github.com/Ferdinand99/Sylo-Fluxer/issues/25)) ([bd45d29](https://github.com/Ferdinand99/Sylo-Fluxer/commit/bd45d29b993b196b3e64aadf976ec801bc0b18c6))
* use a self-hosted instance's own media and CDN hosts ([#21](https://github.com/Ferdinand99/Sylo-Fluxer/issues/21)) ([8a43bde](https://github.com/Ferdinand99/Sylo-Fluxer/commit/8a43bded8e3b6ac411635fad0079d3de4b213998))
* verify on freshly posted messages and fill in {server} in verifi… ([#22](https://github.com/Ferdinand99/Sylo-Fluxer/issues/22)) ([46b97e5](https://github.com/Ferdinand99/Sylo-Fluxer/commit/46b97e503bf4679fa57bf6898c6950d2fbc7f5a1))

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
