// Minimal stand-ins for command invocations, for router/handler tests.
import { PermissionsBitField } from '../../src/platform/index.js';

/** A command interaction, for the command-override checks. */
export function fakeCommandInteraction({ guildId, commandName, channelId, isAdmin = false, roleIds = [] }) {
  return {
    commandName,
    channelId,
    inGuild: () => Boolean(guildId),
    guildId,
    memberPermissions: { has: () => isAdmin },
    member: { roles: { cache: new Map(roleIds.map((id) => [id, { id }])) } },
  };
}

/**
 * A Fluxer-ish message for the prefix router. `sent` collects every reply /
 * DM payload; `reactions` every emoji the bot added.
 */
export function fakeMessage({
  content,
  guildId = '700000000000000001',
  channelId = '700000000000000010',
  authorId = '700000000000000100',
  botId = '700000000000000999',
  commands = new Map(),
  perms = [],
  roleIds = [],
} = {}) {
  const sent = [];
  const reactions = [];
  const permissions = new PermissionsBitField(perms);
  const channel = { id: channelId, guildId, sendTyping: async () => {} };
  const member = {
    id: authorId,
    permissionsIn: () => permissions,
    roles: { cache: new Map(roleIds.map((id) => [id, { id }])) },
  };
  const guild = guildId
    ? {
        id: guildId,
        name: 'Test guild',
        members: { get: () => member, fetch: async () => member, values: () => [member][Symbol.iterator]() },
        channels: { get: () => channel, values: () => [channel][Symbol.iterator]() },
        roles: { get: () => null, values: () => [][Symbol.iterator](), everyone: null },
      }
    : null;
  const makeSent = (payload) => {
    const msg = {
      payload,
      deleted: false,
      edit: async (p) => {
        msg.payload = p;
        return msg;
      },
      delete: async () => {
        msg.deleted = true;
      },
    };
    sent.push(msg);
    return msg;
  };
  const author = {
    id: authorId,
    bot: false,
    username: 'tester',
    send: async (payload) => makeSent({ dm: true, ...payload }),
  };
  const message = {
    id: '700000000000001000',
    content,
    guildId,
    channelId,
    guild,
    channel,
    member: guildId ? member : null,
    author,
    webhookId: null,
    createdAt: new Date(),
    client: { user: { id: botId }, commands, users: { fetch: async () => author } },
    reply: async (payload) => makeSent(typeof payload === 'string' ? { content: payload } : payload),
    react: async (emoji) => reactions.push(emoji),
    delete: async () => {
      message.deleted = true;
    },
  };
  return { message, sent, reactions };
}
