import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseUserId,
  parseRoleId,
  parseChannelId,
  mentionedUserIds,
  mentionedRoleIds,
  mentionsEveryone,
} from '../src/platform/mentions.js';

const ID = '1553777131115261952';

test('parseUserId accepts a mention, a bare id, and an @-prefixed id', () => {
  for (const input of [ID, `<@${ID}>`, `<@!${ID}>`, `@${ID}`, `  @${ID}  `]) {
    assert.equal(parseUserId(input), ID, input);
  }
});

test('parseUserId rejects names, other mention kinds and junk', () => {
  for (const input of ['@someone', `<#${ID}>`, `<@&${ID}>`, '12345', '', null, undefined]) {
    assert.equal(parseUserId(input), null, String(input));
  }
});

test('role and channel parsers only take their own mention form or a bare id', () => {
  assert.equal(parseRoleId(`<@&${ID}>`), ID);
  assert.equal(parseRoleId(`<@${ID}>`), null);
  assert.equal(parseChannelId(`<#${ID}>`), ID);
  assert.equal(parseChannelId(ID), ID);
});

test('mention helpers read both the Fluxer and the discord.js message shape', () => {
  const fluxer = { mentions: [{ id: '1' }, { id: '2' }], mentionRoles: ['9'], mentionEveryone: true };
  assert.deepEqual(mentionedUserIds(fluxer), ['1', '2']);
  assert.deepEqual(mentionedRoleIds(fluxer), ['9']);
  assert.equal(mentionsEveryone(fluxer), true);

  const djs = { mentions: { users: new Map([['3', {}]]), roles: new Map(), everyone: false } };
  assert.deepEqual(mentionedUserIds(djs), ['3']);
  assert.deepEqual(mentionedRoleIds(djs), []);
  assert.equal(mentionsEveryone(djs), false);

  assert.deepEqual(mentionedUserIds({}), [], 'no mentions at all');
});
