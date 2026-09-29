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

const getter = (cls, name) => Object.getOwnPropertyDescriptor(cls.prototype, name).get;
const perms = (...names) => ({ has: (n) => names.includes(n) });

test('channel.manageable / viewable follow the bot’s own permissions in that channel', () => {
  const channelWith = (...names) => ({
    guild: { members: { me: { permissionsIn: () => perms(...names) } } },
  });
  const manageable = getter(GuildChannel, 'manageable');
  const viewable = getter(GuildChannel, 'viewable');
  assert.equal(manageable.call(channelWith('ViewChannel', 'ManageChannels')), true);
  assert.equal(manageable.call(channelWith('ViewChannel')), false);
  assert.equal(viewable.call(channelWith('ViewChannel')), true);
  assert.equal(manageable.call({ guild: { members: { me: null } } }), false, 'bot member not fetched');
});

test('member.manageable: not the owner, not the bot, and below the bot’s highest role', () => {
  const manageable = getter(GuildMember, 'manageable');
  const me = { id: 'bot', roles: { highest: { position: 10 } } };
  const guild = { ownerId: 'owner', members: { me } };
  const member = (id, position) => ({ id, guild, roles: { highest: { position } } });
  assert.equal(manageable.call(member('u1', 5)), true);
  assert.equal(manageable.call(member('u2', 10)), false, 'equal rank');
  assert.equal(manageable.call(member('owner', 1)), false, 'owner');
  assert.equal(manageable.call(member('bot', 1)), false, 'itself');
});

test('message.deletable: own messages always, others with Manage Messages', () => {
  const deletable = getter(Message, 'deletable');
  const channelWith = (...names) => ({
    guildId: '1',
    guild: { members: { me: { permissionsIn: () => perms(...names) } } },
  });
  const client = { user: { id: 'bot' }, channels: new Collection() };
  const msg = (authorId, channel) => ({ author: { id: authorId }, channel, client });
  assert.equal(deletable.call(msg('bot', channelWith())), true);
  assert.equal(deletable.call(msg('user', channelWith('ManageMessages'))), true);
  assert.equal(deletable.call(msg('user', channelWith('SendMessages'))), false);
});
