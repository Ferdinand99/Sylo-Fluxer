// Reactions reach modules with a message whose guildId is filled in, even when
// the message came from the cache as the bot's own REST send (no guild_id).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Collection } from '@fluxerjs/collection';
import { withMessage } from '../src/bot/events/moduleEvents.js';

const G = '100000000000000001';
const C = '100000000000000002';
const client = {
  channels: new Collection([[C, { id: C, guildId: G }]]),
  guilds: new Collection([[G, { id: G }]]),
};

test('a cached message without guild_id gets it from its channel', async () => {
  const cached = { id: '5', channelId: C, guildId: null };
  const reaction = { message: cached, emoji: { name: '✅' } };
  const wrapped = await withMessage(client, reaction, null);
  assert.equal(wrapped.message.guildId, G);
  assert.equal(wrapped.emoji.name, '✅', 'still the reaction underneath');
});

test('an uncached message is fetched, then filled', async () => {
  const reaction = { message: null, fetchMessage: async () => ({ id: '6', channelId: C, guildId: null }) };
  const wrapped = await withMessage(client, reaction, null);
  assert.equal(wrapped.message.guildId, G);
});
