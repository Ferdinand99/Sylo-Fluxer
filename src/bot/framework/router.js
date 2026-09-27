// Prefix-command router: turns `<prefix>name args…` (or `@Sylo name args…`)
// into a command call. Checks, in order: guild-only, the command's default
// member permissions (Fluxer has no slash-command permission gating, so it is
// enforced here), per-guild overrides, then argument parsing + resolution.
// Unknown names fall through to the guild's custom commands.
import { PermissionFlagsBits, permissionNames, MessageFlags } from '../../platform/index.js';
import { getPrefix } from '../../db/guildSettings.js';
import { getCommandOverride } from '../../db/commandOverrides.js';
import { handleCustomCommand } from '../lib/customCommandRun.js';
import { MessageInteraction } from './MessageInteraction.js';
import { parseArgs } from './parser.js';
import { resolveValues } from './resolve.js';
import { usageLine } from './usage.js';
import { OptionType } from './CommandBuilder.js';
import { log } from '../../lib/log.js';
import { inc } from '../../lib/metrics.js';

/**
 * Split a message into command name + argument text, or null when it isn't a
 * command. Accepts the prefix or a leading mention of the bot.
 * @param {string} content
 * @param {string} prefix
 * @param {string | null} botId
 * @returns {{ name: string, rest: string, prefix: string } | null}
 */
export function splitCommand(content, prefix, botId) {
  let body = null;
  if (content.startsWith(prefix)) body = content.slice(prefix.length);
  else if (botId) {
    const m = new RegExp(`^<@!?${botId}>\\s*`).exec(content);
    if (m) body = content.slice(m[0].length);
  }
  if (body == null) return null;
  const m = /^([a-z0-9_-]+)(?:\s+|$)/i.exec(body);
  if (!m) return null;
  return { name: m[1].toLowerCase(), rest: body.slice(m[0].length), prefix };
}

/**
 * Find a built-in command by name or alias.
 * @param {Map<string, { data: any, execute: Function }>} commands
 * @param {string} name
 */
export function findCommand(commands, name) {
  if (!commands) return null;
  const direct = commands.get(name);
  if (direct) return direct;
  for (const cmd of commands.values()) if (cmd.data.aliases?.includes(name)) return cmd;
  return null;
}

/**
 * Check a per-guild command override. Returns a user-facing block reason, or
 * null when the command may run.
 *
 * A full disable applies to everyone (admins included) — if a server turns a
 * command off, it's off. Channel / role restrictions are bypassed by
 * administrators.
 * @param {MessageInteraction} interaction
 */
export async function overrideBlockReason(interaction) {
  if (!interaction.inGuild()) return null;

  const ov = await getCommandOverride(interaction.guildId, interaction.commandName);
  if (!ov) return null;

  if (!ov.enabled) return 'This command is disabled in this server.';

  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return null;

  if (ov.allowedChannels.length && !ov.allowedChannels.includes(interaction.channelId)) {
    return `This command can only be used in: ${ov.allowedChannels.map((c) => `<#${c}>`).join(', ')}.`;
  }

  if (ov.allowedRoles.length) {
    const roles = interaction.member?.roles;
    const ids = roles?.cache ? [...roles.cache.keys()] : Array.isArray(roles) ? roles : [];
    if (!ov.allowedRoles.some((r) => ids.includes(r))) {
      return 'You do not have a role allowed to use this command here.';
    }
  }

  return null;
}

/** Missing default-member permissions for this invocation, as readable names. */
function missingPermissions(data, interaction) {
  const required = data.default_member_permissions;
  if (required === undefined || !interaction.inGuild()) return [];
  const have = interaction.memberPermissions;
  const need = BigInt(required);
  if (have?.has(need)) return [];
  const haveBits = have ? BigInt(have.bitfield) : 0n;
  return permissionNames(need & ~haveBits);
}

const privateReply = (text) => ({ content: text, flags: MessageFlags.Ephemeral });

/**
 * Handle one incoming message. Returns true when it was a command.
 * @param {import('@fluxerjs/core').Message} message
 */
export async function handleMessage(message) {
  if (message.author?.bot || message.webhookId || !message.content) return false;
  const client = message.client;
  const prefix = await getPrefix(message.guildId);
  const split = splitCommand(message.content, prefix, client.user?.id ?? null);
  if (!split) return false;

  const guild = message.guild;
  const member = guild
    ? (message.member ?? (await guild.members.fetch(message.author.id).catch(() => null)))
    : null;
  const command = findCommand(client.commands, split.name);

  if (!command) {
    if (!guild) return false;
    const ix = new MessageInteraction({ message, commandName: split.name, member });
    ix.setArguments(null, new Map([['text', { value: split.rest.trim() }]]));
    try {
      return await handleCustomCommand(ix);
    } catch (err) {
      log.error('bot', `Custom command "${split.name}" failed:`, err);
      return true;
    }
  }

  const data = command.data;
  inc('sylo_commands_total', { command: data.name });
  const ix = new MessageInteraction({
    message,
    commandName: data.name,
    member,
    privateReplies: data.privateReplies ?? 'auto',
  });

  if (data.guildOnly && !guild) {
    await ix.reply('This command only works in a server.').catch(() => {});
    return true;
  }

  const missing = missingPermissions(data, ix);
  if (missing.length) {
    await ix
      .reply(privateReply(`⚠️ You need **${missing.join(', ')}** to use \`${prefix}${data.name}\`.`))
      .catch(() => {});
    return true;
  }

  const blocked = await overrideBlockReason(ix);
  if (blocked) {
    await ix.reply(privateReply(`⚠️ ${blocked}`)).catch(() => {});
    return true;
  }

  const parsed = parseArgs(split.rest, data);
  const optionSet = parsed.sub
    ? (data.options.find((o) => o.type === OptionType.Subcommand && o.name === parsed.sub)?.options ?? [])
    : data.options;
  let errors = parsed.errors;
  let resolved = new Map();
  if (!errors.length) {
    ({ resolved, errors } = await resolveValues(message, optionSet, parsed.values));
  }
  if (errors.length) {
    const usage =
      parsed.sub || !data.options.some((o) => o.type === OptionType.Subcommand)
        ? usageLine(prefix, data.name, optionSet, parsed.sub)
        : `${prefix}${data.name} <${data.options.map((o) => o.name).join('|')}>`;
    await ix
      .reply(
        privateReply(`⚠️ ${errors.join('\n')}\nUsage: \`${usage}\` — see \`${prefix}help ${data.name}\`.`)
      )
      .catch(() => {});
    return true;
  }
  ix.setArguments(parsed.sub, resolved);

  try {
    await command.execute(ix);
  } catch (err) {
    log.error('bot', `Command "${data.name}" threw:`, err);
    const payload = privateReply('⚠️ Something went wrong running that command. Please try again later.');
    try {
      if (ix.deferred || ix.replied) await ix.followUp(payload);
      else await ix.reply(payload);
    } catch {
      // Channel gone or no permission to reply; nothing more to do.
    }
  }
  return true;
}
