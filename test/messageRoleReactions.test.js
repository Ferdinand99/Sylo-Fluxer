import './helpers/tmpDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getMessageRoleChoices, setMessageRoleChoices } from '../src/db/messageRoleReactions.js';
import { purgeGuild } from '../src/db/purge.js';

const G = '700000000000000001';
const C = '700000000000000010';
const M = '700000000000001000';
const choice = { key: '🎮', react: '🎮', display: '🎮', roleId: '700000000000000020', label: 'Gamer' };

test('message role choices round-trip, clear on empty, and purge with the guild', async () => {
  assert.equal(await getMessageRoleChoices(G, M), null);
  await setMessageRoleChoices(G, C, M, [choice]);
  assert.deepEqual(await getMessageRoleChoices(G, M), [choice]);
  await setMessageRoleChoices(G, C, M, []);
  assert.equal(await getMessageRoleChoices(G, M), null);
  await setMessageRoleChoices(G, C, M, [choice]);
  await purgeGuild(G);
  assert.equal(await getMessageRoleChoices(G, M), null);
});
