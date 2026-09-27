// Proves the driver shim's Postgres branch for the message_role_reactions
// table, and that purgeGuild reaches it (purge.js must import its owner so the
// table is bootstrapped in a process that only imports purge.js).
import './helpers/isolateSqlite.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { closePostgres } from '../src/db/driver.js';

const url = process.env.DATABASE_URL;

test(
  'message_role_reactions against a real Postgres connection',
  { skip: !url && 'DATABASE_URL not set (sqlite-only run)' },
  async (t) => {
    const { getMessageRoleChoices, setMessageRoleChoices } =
      await import('../src/db/messageRoleReactions.js');
    const { purgeGuild } = await import('../src/db/purge.js');

    t.after(async () => {
      await closePostgres();
    });

    const G = `pgtest-mrr-${Date.now()}`;
    const C = '111111111111111111';
    const M = `${Date.now()}`;
    const choice = { key: '🎮', react: '🎮', display: '🎮', roleId: '222222222222222222', label: 'Gamer' };

    await t.test('set / get round-trip, then upsert replaces the choices', async () => {
      assert.equal(await getMessageRoleChoices(G, M), null);
      await setMessageRoleChoices(G, C, M, [choice]);
      assert.deepEqual(await getMessageRoleChoices(G, M), [choice]);
      const other = { ...choice, key: '1️⃣', react: '1️⃣', display: '1️⃣' };
      await setMessageRoleChoices(G, C, M, [other]);
      assert.deepEqual(await getMessageRoleChoices(G, M), [other]);
    });

    await t.test('an empty list clears the row', async () => {
      await setMessageRoleChoices(G, C, M, []);
      assert.equal(await getMessageRoleChoices(G, M), null);
    });

    await t.test('purgeGuild removes the guild’s rows', async () => {
      await setMessageRoleChoices(G, C, M, [choice]);
      await purgeGuild(G);
      assert.equal(await getMessageRoleChoices(G, M), null);
    });
  }
);
