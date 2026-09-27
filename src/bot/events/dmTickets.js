// DM → ticket bridge. A DM to the bot opens (or appends to) a ticket. When the
// user shares several ticket-enabled servers and has no open ticket, the bot
// lists them with numbers and the user replies with one (Fluxer has no select
// menus). DMs that are bot commands (e.g. `!mydata`) are left to the router.
import { Events } from '../../platform/index.js';
import { ticketGuildsForUser, ingestUserDM } from '../../modules/tickets.js';
import { getOpenTicket } from '../../db/tickets.js';
import { DEFAULT_PREFIX } from '../../db/guildSettings.js';
import { splitCommand, findCommand } from '../framework/router.js';
import { log } from '../../lib/log.js';

/** userId -> { payload: { content, attachments }, guildIds: string[], at } */
const pending = new Map();
const PENDING_TTL = 10 * 60 * 1000;

function takePending(userId) {
  const p = pending.get(userId);
  pending.delete(userId);
  if (!p || Date.now() - p.at > PENDING_TTL) return null;
  return p;
}

/** Is this DM a built-in command (handled by the prefix router instead)? */
function isCommand(message) {
  const split = splitCommand(message.content ?? '', DEFAULT_PREFIX, message.client.user?.id ?? null);
  return Boolean(split && findCommand(message.client.commands, split.name));
}

async function handleDM(message) {
  if (message.guildId || message.author.bot) return;
  if (isCommand(message)) return;

  const payload = {
    content: message.content ?? '',
    attachments: [...message.attachments.values()].map((a) => a.url),
  };
  if (!payload.content && payload.attachments.length === 0) return;

  // An answer to "which server?" — a bare number while a choice is pending.
  const choice = /^\s*(\d{1,2})\s*$/.exec(payload.content);
  if (choice && !payload.attachments.length && pending.has(message.author.id)) {
    const p = takePending(message.author.id);
    const guild = p ? message.client.guilds.get(p.guildIds[Number(choice[1]) - 1]) : null;
    if (!p) {
      await message.reply('That request expired — send your message again.').catch(() => {});
      return;
    }
    if (!guild) {
      pending.set(message.author.id, p); // keep it; they mistyped
      await message.reply(`Reply with a number from 1 to ${p.guildIds.length}.`).catch(() => {});
      return;
    }
    const ticket = await ingestUserDM(guild, message.author, p.payload);
    await message
      .reply(`Opened ticket #${ticket.id} for **${guild.name}**. Just keep replying here.`)
      .catch(() => {});
    return;
  }

  const guilds = await ticketGuildsForUser(message.author);
  if (guilds.length === 0) {
    await message
      .reply("I'm not set up to take messages for any server you're in right now.")
      .catch(() => {});
    return;
  }

  // If there's exactly one open ticket already, keep the conversation there.
  const openFlags = await Promise.all(guilds.map((g) => getOpenTicket(g.id, message.author.id)));
  const openGuilds = guilds.filter((g, i) => openFlags[i]);
  if (openGuilds.length === 1) {
    await ingestUserDM(openGuilds[0], message.author, payload);
    await message.react('✅').catch(() => {});
    return;
  }
  if (openGuilds.length === 0 && guilds.length === 1) {
    await ingestUserDM(guilds[0], message.author, payload);
    await message.react('✅').catch(() => {});
    return;
  }

  // Ambiguous — ask which server.
  const options = (openGuilds.length ? openGuilds : guilds).slice(0, 25);
  pending.set(message.author.id, { payload, guildIds: options.map((g) => g.id), at: Date.now() });
  const list = options.map((g, i) => `**${i + 1}.** ${g.name}`).join('\n');
  await message
    .reply(`You can reach staff in more than one server. Reply with the number of the one you mean:\n${list}`)
    .catch(() => {});
}

/** @param {import('@fluxerjs/core').Client} client */
export function register(client) {
  client.on(Events.MessageCreate, (message) => {
    handleDM(message).catch((err) => log.error('tickets', 'DM handler failed:', err));
  });
}
