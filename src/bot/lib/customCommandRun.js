// Runs a guild's custom commands (defined on the dashboard). Fluxer has no
// slash commands, so there is nothing to register: when a prefixed message
// names no built-in command, the router asks handleCustomCommand() whether the
// guild has a custom command by that name. Everything after the name fills
// {args}.
import { MessageFlags } from '../../platform/index.js';
import { getGuildModule } from '../../db/modules.js';
import { pickMessage, buildActionPayload } from '../../modules/customCommands.js';
import { log } from '../../lib/log.js';

// --- execution ---------------------------------------------------------------

const cooldowns = new Map(); // `${guildId}:${name}:${userId}` -> expiresAt (ms)

function blockReason(cmd, interaction) {
  if (cmd.allowedChannels?.length && !cmd.allowedChannels.includes(interaction.channelId)) {
    return `This command can only be used in: ${cmd.allowedChannels.map((c) => `<#${c}>`).join(', ')}.`;
  }
  if (cmd.allowedRoles?.length) {
    const roles = interaction.member?.roles;
    const ids = roles?.cache ? [...roles.cache.keys()] : Array.isArray(roles) ? roles : [];
    if (!cmd.allowedRoles.some((r) => ids.includes(r))) {
      return 'You do not have a role allowed to use this command.';
    }
  }
  if (cmd.cooldownSeconds > 0) {
    const key = `${interaction.guildId}:${cmd.name}:${interaction.user.id}`;
    const until = cooldowns.get(key) ?? 0;
    if (Date.now() < until) {
      return `⏳ That command is on cooldown — try again in ${Math.ceil((until - Date.now()) / 1000)}s.`;
    }
    cooldowns.set(key, Date.now() + cmd.cooldownSeconds * 1000);
  }
  return null;
}

/**
 * Run a custom command, if the guild has one called `interaction.commandName`.
 * Returns true if it was a custom command (and was handled).
 * @param {import('../framework/MessageInteraction.js').MessageInteraction} interaction
 *   with its `text` option set to everything after the command name
 */
export async function handleCustomCommand(interaction) {
  if (!interaction.inGuild()) return false;
  const { enabled, config: cfg } = await getGuildModule(interaction.guildId, 'custom-commands');
  if (!enabled) return false;

  const cmd = (cfg.commands ?? []).find((c) => c.name === interaction.commandName);
  if (!cmd) return false;

  const blocked = blockReason(cmd, interaction);
  if (blocked) {
    await interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  const ctx = {
    userId: interaction.user.id,
    username: interaction.user.username,
    guildName: interaction.guild?.name ?? '',
    channelId: interaction.channelId,
    args: interaction.options.getString('text') ?? '',
  };

  const firstReply = cmd.actions.find((a) => a.type === 'reply');
  const deferEphemeral = firstReply ? firstReply.private : true;
  await interaction.deferReply(deferEphemeral ? { flags: MessageFlags.Ephemeral } : {}).catch(() => {});

  let answered = false;
  for (const action of cmd.actions) {
    try {
      if (action.type === 'reply') {
        const payload = buildActionPayload(pickMessage(action.messages), ctx);
        if (!answered) {
          await interaction.editReply(payload);
          answered = true;
        } else {
          await interaction.followUp({
            ...payload,
            flags: action.private ? MessageFlags.Ephemeral : undefined,
          });
        }
      } else if (action.type === 'send') {
        if (!/^\d{17,20}$/.test(action.channelId)) continue;
        const ch = interaction.guild.channels.get(action.channelId);
        if (ch?.isTextBased()) await ch.send(buildActionPayload(pickMessage(action.messages), ctx));
      } else if (action.type === 'add-role' || action.type === 'remove-role') {
        if (!/^\d{17,20}$/.test(action.roleId)) continue;
        const member =
          interaction.member && interaction.member.roles?.add
            ? interaction.member
            : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) continue;
        if (action.type === 'add-role') await member.roles.add(action.roleId, 'Custom command');
        else await member.roles.remove(action.roleId, 'Custom command');
      }
    } catch (err) {
      log.error('custom-commands', `"${cmd.name}" action "${action.type}" failed:`, err.message);
    }
  }

  if (!answered) await interaction.editReply({ content: '✅ Done.' }).catch(() => {});
  return true;
}
