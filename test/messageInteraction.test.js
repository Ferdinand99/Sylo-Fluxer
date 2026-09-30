// MessageInteraction delivery: a reply falls back to a plain channel message
// when the invoking message is gone (e.g. !purge deleted it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageInteraction } from '../src/bot/framework/MessageInteraction.js';

function invocation({ replyFails }) {
  const sent = [];
  const channel = {
    guildId: '1',
    send: async (p) => {
      sent.push({ via: 'send', p });
      return { id: 'sent', delete: async () => {}, edit: async (x) => x };
    },
    sendTyping: async () => {},
  };
  const message = {
    id: '100',
    channelId: '2',
    guildId: '1',
    author: { id: '3' },
    client: {},
    channel,
    reply: async (p) => {
      if (replyFails) throw new Error("Message wasn't found.");
      sent.push({ via: 'reply', p });
      return { id: 'reply', delete: async () => {}, edit: async (x) => x };
    },
    delete: async () => {},
  };
  return { ix: new MessageInteraction({ message, commandName: 'purge' }), sent };
}

test('reply goes to the invoking message while it exists', async () => {
  const { ix, sent } = invocation({ replyFails: false });
  await ix.reply('done');
  assert.deepEqual(
    sent.map((s) => s.via),
    ['reply']
  );
});

test('a deferred reply to a deleted invoking message is sent to the channel instead', async () => {
  const { ix, sent } = invocation({ replyFails: true });
  await ix.deferReply();
  const msg = await ix.editReply('🧹 Deleted 10 messages.');
  assert.equal(msg.id, 'sent');
  assert.deepEqual(sent, [{ via: 'send', p: { content: '🧹 Deleted 10 messages.' } }]);
});
