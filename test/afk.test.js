import './helpers/tmpDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getAfk, setAfk, clearAfk, clearGuildAfk } from '../src/db/afk.js';
import { normaliseServerStats } from '../src/modules/serverStats.js';
import { isAfkCommand } from '../src/modules/afk.js';

const G = '111111111111111111';
const U = '222222222222222222';

test('afk: set / get / clear round-trip', async () => {
  assert.equal(await getAfk(G, U), null);
  await setAfk(G, U, { reason: 'lunch', oldNick: 'Bob' });
  const row = await getAfk(G, U);
  assert.equal(row.reason, 'lunch');
  assert.equal(row.old_nick, 'Bob');
  assert.ok(row.since > 0);
  await clearAfk(G, U);
  assert.equal(await getAfk(G, U), null);
});

test('afk: oldNick null is stored as null (nickname untouched)', async () => {
  await setAfk(G, U, { reason: 'x', oldNick: null });
  assert.equal((await getAfk(G, U)).old_nick, null);
  await clearGuildAfk(G);
  assert.equal(await getAfk(G, U), null);
});

test('normaliseServerStats: drops rows without {count} or a channel, clamps to 10, defaults type', () => {
  const c = normaliseServerStats({
    channels: [
      { channelId: '123456789012345678', type: 'humans', template: 'Humans: {count}' },
      { channelId: '123456789012345678', type: 'bogus', template: 'no placeholder' }, // dropped
      { channelId: 'nope', type: 'members', template: '{count}' }, // dropped (bad id)
      { channelId: '223456789012345678', template: 'Roles {count}' }, // type defaults
    ],
  });
  assert.equal(c.channels.length, 2);
  assert.equal(c.channels[0].type, 'humans');
  assert.equal(c.channels[1].type, 'members');
});

test('normaliseServerStats: refreshMinutes defaults to 10 and clamps to 5..60', () => {
  assert.equal(normaliseServerStats({}).refreshMinutes, 10);
  assert.equal(normaliseServerStats({ refreshMinutes: 1 }).refreshMinutes, 5);
  assert.equal(normaliseServerStats({ refreshMinutes: 999 }).refreshMinutes, 60);
  assert.equal(normaliseServerStats({ refreshMinutes: '15' }).refreshMinutes, 15);
  assert.equal(normaliseServerStats({ refreshMinutes: 'abc' }).refreshMinutes, 10);
});

test('isAfkCommand: the !afk command itself does not count as "back from AFK"', async () => {
  const commands = new Map([
    ['afk', { data: { name: 'afk' } }],
    ['rank', { data: { name: 'rank', aliases: ['level'] } }],
  ]);
  const client = { user: { id: '999999999999999999' }, commands };
  const msg = (content) => ({ content, client });
  const G = '111111111111111111';
  assert.equal(await isAfkCommand(msg('!afk'), G), true);
  assert.equal(await isAfkCommand(msg('!afk gaming'), G), true);
  assert.equal(await isAfkCommand(msg('<@999999999999999999> afk'), G), true, 'mentioning the bot');
  assert.equal(await isAfkCommand(msg('!rank'), G), false, 'other commands still clear AFK');
  assert.equal(await isAfkCommand(msg('hei alle'), G), false);
  assert.equal(await isAfkCommand(msg('!afkish'), G), false);
});
