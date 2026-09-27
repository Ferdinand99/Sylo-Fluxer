import './helpers/tmpDb.js';
import './helpers/openMode.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandBuilder } from '../src/bot/framework/CommandBuilder.js';
import {
  splitCommand,
  findCommand,
  overrideBlockReason,
  handleMessage,
} from '../src/bot/framework/router.js';
import { setCommandOverride } from '../src/db/commandOverrides.js';
import { setPrefix } from '../src/db/guildSettings.js';
import { PermissionFlagsBits, MessageFlags } from '../src/platform/index.js';
import { fakeCommandInteraction, fakeMessage } from './helpers/fakeInteraction.js';

const BOT = '700000000000000999';
const U = '700000000000000555';

test('splitCommand: prefix, bot mention, and non-commands', () => {
  assert.deepEqual(splitCommand('!warn add <@1> hi', '!', BOT), {
    name: 'warn',
    rest: 'add <@1> hi',
    prefix: '!',
  });
  assert.deepEqual(splitCommand(`<@${BOT}> ping`, '!', BOT), { name: 'ping', rest: '', prefix: '!' });
  assert.deepEqual(splitCommand('!PING', '!', BOT)?.name, 'ping');
  assert.equal(splitCommand('hello !ping', '!', BOT), null);
  assert.equal(splitCommand('!', '!', BOT), null);
  assert.equal(splitCommand('!!!', '!', BOT), null);
});

test('findCommand resolves aliases', () => {
  const lb = { data: new CommandBuilder().setName('leaderboard').setAliases(['lb']), execute() {} };
  const commands = new Map([['leaderboard', lb]]);
  assert.equal(findCommand(commands, 'leaderboard'), lb);
  assert.equal(findCommand(commands, 'lb'), lb);
  assert.equal(findCommand(commands, 'nope'), null);
});

test('overrideBlockReason', async (t) => {
  const G = '700000000000000001';
  const CH_OK = '700000000000000010';
  const CH_NO = '700000000000000011';
  const ROLE = '700000000000000020';

  await t.test('no override → allowed', async () => {
    assert.equal(
      await overrideBlockReason(
        fakeCommandInteraction({ guildId: G, commandName: 'ping', channelId: CH_OK })
      ),
      null
    );
  });

  await t.test('disabled → blocked for everyone, admins included', async () => {
    await setCommandOverride(G, 'ping', { enabled: false });
    const reason = await overrideBlockReason(
      fakeCommandInteraction({ guildId: G, commandName: 'ping', channelId: CH_OK, isAdmin: true })
    );
    assert.match(reason, /disabled/i);
  });

  await t.test('channel restriction blocks a non-admin outside the allowed channel', async () => {
    await setCommandOverride(G, 'rank', { enabled: true, allowedChannels: [CH_OK] });
    assert.match(
      await overrideBlockReason(
        fakeCommandInteraction({ guildId: G, commandName: 'rank', channelId: CH_NO })
      ),
      /can only be used in/i
    );
    assert.equal(
      await overrideBlockReason(
        fakeCommandInteraction({ guildId: G, commandName: 'rank', channelId: CH_OK })
      ),
      null
    );
    assert.equal(
      await overrideBlockReason(
        fakeCommandInteraction({ guildId: G, commandName: 'rank', channelId: CH_NO, isAdmin: true })
      ),
      null
    );
  });

  await t.test('role restriction blocks a member without an allowed role', async () => {
    await setCommandOverride(G, 'stats', { enabled: true, allowedRoles: [ROLE] });
    assert.match(
      await overrideBlockReason(
        fakeCommandInteraction({ guildId: G, commandName: 'stats', channelId: CH_OK })
      ),
      /do not have a role/i
    );
    assert.equal(
      await overrideBlockReason(
        fakeCommandInteraction({ guildId: G, commandName: 'stats', channelId: CH_OK, roleIds: [ROLE] })
      ),
      null
    );
  });
});

test('handleMessage end to end', async (t) => {
  let seen = null;
  const warn = {
    data: new CommandBuilder()
      .setName('warn')
      .setDescription('Warn someone')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName('user').setDescription('who').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('why').setRequired(true)),
    async execute(ix) {
      seen = { user: ix.options.getUser('user')?.id, reason: ix.options.getString('reason') };
      await ix.reply({ content: 'done' });
    },
  };
  const secret = {
    data: new CommandBuilder().setName('secret').setDescription('private'),
    async execute(ix) {
      await ix.reply({ content: 'psst', flags: MessageFlags.Ephemeral });
    },
  };
  const commands = new Map([
    ['warn', warn],
    ['secret', secret],
  ]);
  const users = { fetch: async (id) => ({ id, username: 'target' }) };

  await t.test('parses arguments and runs the command', async () => {
    seen = null;
    const { message, sent } = fakeMessage({
      content: `!warn <@${U}> spamming the chat`,
      commands,
      perms: ['ModerateMembers'],
    });
    message.client.users = users;
    message.guild.members.fetch = async () => null; // not a member: falls back to users.fetch
    assert.equal(await handleMessage(message), true);
    assert.deepEqual(seen, { user: U, reason: 'spamming the chat' });
    assert.equal(sent[0].payload.content, 'done');
  });

  await t.test('enforces default member permissions', async () => {
    seen = null;
    const { message, sent } = fakeMessage({ content: `!warn <@${U}> x`, commands });
    await handleMessage(message);
    assert.equal(seen, null);
    assert.match(sent[0].payload.content, /You need \*\*Moderate Members\*\*/);
  });

  await t.test('reports parse errors with usage', async () => {
    const { message, sent } = fakeMessage({ content: '!warn', commands, perms: ['ModerateMembers'] });
    await handleMessage(message);
    assert.match(sent[0].payload.content, /Missing `user`/);
    assert.match(sent[0].payload.content, /Usage: `!warn <user> <reason…>`/);
  });

  await t.test('ephemeral replies are delivered in the channel (auto mode)', async () => {
    const { message, sent } = fakeMessage({ content: '!secret', commands });
    await handleMessage(message);
    assert.equal(sent[0].payload.content, 'psst');
    assert.equal(sent[0].payload.flags, undefined, 'the ephemeral flag is stripped before sending');
  });

  await t.test('a per-guild prefix replaces `!`', async () => {
    const G = '700000000000000777';
    await setPrefix(G, '?');
    const bang = fakeMessage({ content: '!secret', commands, guildId: G });
    assert.equal(await handleMessage(bang.message), false);
    const q = fakeMessage({ content: '?secret', commands, guildId: G });
    assert.equal(await handleMessage(q.message), true);
  });

  await t.test('ignores bots and plain chat', async () => {
    const { message } = fakeMessage({ content: 'just talking', commands });
    assert.equal(await handleMessage(message), false);
    const bot = fakeMessage({ content: '!secret', commands });
    bot.message.author.bot = true;
    assert.equal(await handleMessage(bot.message), false);
  });
});
