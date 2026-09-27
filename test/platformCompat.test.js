// The compatibility layer patches the real Fluxer SDK classes. These tests pin
// that the patches are installed against the pinned SDK version and behave.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ChannelManager,
  Guild,
  GuildChannel,
  GuildMember,
  Message,
  MessageManager,
  MessageReaction,
  PartialMessage,
  Role,
  User,
} from '@fluxerjs/core';
import { Collection } from '@fluxerjs/collection';
import '../src/platform/index.js';
import { withGuildId, mergeLegacyOverwrite } from '../src/platform/compat.js';
import { PermissionFlagsBits } from '../src/platform/index.js';

const G = '100000000000000001';
const C = '100000000000000002';

function fakeClient() {
  const channel = { id: C, guildId: G };
  return {
    channels: new Collection([[C, channel]]),
    guilds: new Collection([[G, { id: G, channels: new Collection([[C, channel]]) }]]),
  };
}

test('withGuildId fills guildId on REST messages from the channel cache', () => {
  const client = fakeClient();
  const one = { id: '1', channelId: C, guildId: null };
  assert.equal(withGuildId(client, one).guildId, G);

  const many = new Collection([['2', { id: '2', channelId: C, guildId: null }]]);
  withGuildId(client, many);
  assert.equal(many.get('2').guildId, G);

  const dm = { id: '3', channelId: '999999999999999999', guildId: null };
  assert.equal(withGuildId(client, dm).guildId, null, 'unknown channel (a DM) stays null');

  const already = { id: '4', channelId: C, guildId: '555555555555555555' };
  assert.equal(withGuildId(client, already).guildId, '555555555555555555', 'never overwritten');
});

test('REST message fetchers are wrapped to fill guildId', () => {
  for (const [proto, name] of [
    [MessageManager.prototype, 'fetch'],
    [ChannelManager.prototype, 'fetchMessage'],
    [MessageReaction.prototype, 'fetchMessage'],
    [Message.prototype, 'fetch'],
    [PartialMessage.prototype, 'fetch'],
  ]) {
    assert.equal(typeof proto[name], 'function', `${proto.constructor.name}.${name}`);
    assert.match(proto[name].toString(), /withGuildId/, `${proto.constructor.name}.${name} is wrapped`);
  }
});

test('discord.js-shaped aliases exist on the SDK classes', () => {
  for (const [cls, names] of [
    [Guild, ['bans', 'invites', 'voiceStates']],
    [GuildChannel, ['guild', 'permissionsFor', 'setName', 'setRateLimitPerUser', 'members', 'rawPosition']],
    [GuildMember, ['setNickname', 'voice', 'communicationDisabledUntilTimestamp']],
    [Role, ['comparePositionTo', 'editable', 'guild']],
    [User, ['tag']],
    [Message, ['inGuild', 'url', 'createdTimestamp']],
    [MessageReaction, ['users', 'remove', 'partial']],
  ]) {
    for (const n of names) {
      assert.ok(Object.getOwnPropertyDescriptor(cls.prototype, n), `${cls.name}.prototype.${n} is installed`);
    }
  }
});

test('mergeLegacyOverwrite maps true / false / null onto allow / deny bits', () => {
  const send = PermissionFlagsBits.SendMessages;
  const react = PermissionFlagsBits.AddReactions;
  const { allow, deny } = mergeLegacyOverwrite(send, 0n, { SendMessages: false, AddReactions: true });
  assert.equal(allow & send, 0n);
  assert.equal(deny & send, send);
  assert.equal(allow & react, react);
  const cleared = mergeLegacyOverwrite(send, react, { SendMessages: null, AddReactions: null });
  assert.equal(cleared.allow, 0n);
  assert.equal(cleared.deny, 0n);
});
