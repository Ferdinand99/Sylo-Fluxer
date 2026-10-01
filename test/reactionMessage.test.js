// Reactions reach modules with a message whose guildId is filled in, even when
// the message came from the cache as the bot's own REST send (no guild_id).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Collection } from '@fluxerjs/collection';
import { withMessage, withFullUser } from '../src/bot/events/moduleEvents.js';

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

test('a leaving member with a bare user (id only) gets the full user fetched', async () => {
  let asked;
  const full = { id: '7', username: 'gin', tag: 'gin' };
  const client = { users: { fetch: async (id, opts) => ((asked = [id, opts]), full) } };
  const bare = { id: '7', user: { id: '7' }, guild: { id: G } };
  const out = await withFullUser(client, bare);
  assert.deepEqual(asked, ['7', { force: true }], 'forced past the bare cached user');
  assert.equal(out.user.username, 'gin');
  assert.equal(out.guild.id, G, 'still the same member underneath');

  const complete = { id: '8', user: { id: '8', username: 'kim' } };
  assert.equal(await withFullUser(client, complete), complete, 'no fetch when the user is complete');
});
