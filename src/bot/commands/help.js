// !help — overview of Sylo's commands and where to configure it.
//   !help             categories + how commands are typed
//   !help <category>  that category's commands with their usage
//   !help <command>   full usage: arguments, permissions, examples
// Fluxer has no select menus, so categories are picked by typing their name.
import { SlashCommandBuilder } from '../framework/CommandBuilder.js';
import { EmbedBuilder, permissionNames } from '../../platform/index.js';
import { findCommand } from '../framework/router.js';
import { usageLines, optionHelp } from '../framework/usage.js';
import { getPrefix } from '../../db/guildSettings.js';
import { config } from '../../config.js';

const COLOR = 0x5b7cfa;
const OVERVIEW_DESCRIPTION =
  'Server features — moderation, logging, tickets, reaction roles, welcome, sticky messages, ' +
  'auto-moderation, counting, custom commands, autoresponder, auto-react, scheduled messages and ' +
  'leveling — are enabled and configured from the dashboard.';

// Command names grouped for display. Anything not listed still shows under
// "Other" (only if there's anything left over), so !help stays honest as
// commands are added. Embed fields cap at 1024 characters and descriptions at
// 4096 — buildCategoryEmbed() truncates defensively.
export const GROUPS = [
  { name: 'General', commands: ['help', 'about', 'version', 'ping', 'stats', 'prefix'] },
  { name: 'Leveling', commands: ['rank', 'leaderboard'] },
  { name: 'Community', commands: ['afk', 'birthday'] },
  {
    name: 'Moderation',
    commands: [
      'kick',
      'ban',
      'unban',
      'timeout',
      'untimeout',
      'purge',
      'slowmode',
      'lock',
      'unlock',
      'lockdown',
      'warn',
      'modlog',
    ],
  },
  { name: 'Case log', commands: ['case', 'history'] },
  { name: 'Invites', commands: ['inviter', 'invites', 'invites-leaderboard'] },
  {
    name: 'Voice channels',
    commands: [
      'voice-claim',
      'voice-transfer',
      'voice-rename',
      'voice-limit',
      'voice-lock',
      'voice-unlock',
      'voice-hide',
      'voice-reveal',
      'voice-kick',
      'voice-ban',
      'voice-unban',
      'voice-owner',
      'voice-clean',
    ],
  },
  { name: 'Engagement', commands: ['giveaway', 'poll', 'poll-end', 'freegames'] },
  { name: 'Privacy', commands: ['mydata', 'forget'] },
];

const DESCRIPTION_LIMIT = 4000;

/** Every command not covered by any GROUPS entry — empty when the list above is kept in sync. */
export function otherCommands(all) {
  const grouped = new Set(GROUPS.flatMap((g) => g.commands));
  return [...all.values()].filter((c) => !grouped.has(c.data.name));
}

const truncated = (value, limit) => (value.length > limit ? `${value.slice(0, limit - 1)}…` : value);

function categories(all) {
  const list = GROUPS.map((g) => ({
    name: g.name,
    commands: g.commands.map((n) => all.get(n)).filter(Boolean),
  }));
  const other = otherCommands(all);
  if (other.length) list.push({ name: 'Other', commands: other });
  return list.filter((c) => c.commands.length > 0);
}

function buildOverviewEmbed(cats, prefix) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('Sylo — help')
    .setDescription(
      `Commands start with \`${prefix}\` (or mention me). ${OVERVIEW_DESCRIPTION}\n\n` +
        `\`${prefix}help <category>\` lists a category · \`${prefix}help <command>\` shows how to use one.`
    )
    .addFields(
      cats.map((c) => ({
        name: c.name,
        value: truncated(c.commands.map((cmd) => `\`${cmd.data.name}\``).join(' '), 1024),
      }))
    );
  if (config.dashboardUrl) embed.setFooter({ text: `Dashboard: ${config.dashboardUrl}` });
  return embed;
}

function buildCategoryEmbed(cat, prefix) {
  const lines = cat.commands.flatMap((cmd) =>
    usageLines(prefix, cmd.data).map((u) => `\`${u.line}\` — ${u.description}`)
  );
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`Sylo — help — ${cat.name}`)
    .setDescription(truncated(lines.join('\n'), DESCRIPTION_LIMIT))
    .setFooter({ text: `${prefix}help <command> for details` });
}

function buildCommandEmbed(cmd, prefix) {
  const data = cmd.data;
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`${prefix}${data.name}`)
    .setDescription(data.description || null);
  for (const u of usageLines(prefix, data)) {
    const opts = u.options.map(optionHelp).join('\n');
    embed.addFields({
      name: u.sub ? `${u.sub} — ${u.description}` : 'Usage',
      value: truncated(`\`${u.line}\`${opts ? `\n${opts}` : ''}`, 1024),
    });
  }
  const extras = [];
  if (data.aliases?.length)
    extras.push(`Aliases: ${data.aliases.map((a) => `\`${prefix}${a}\``).join(', ')}`);
  if (data.default_member_permissions !== undefined) {
    extras.push(`Requires: ${permissionNames(data.default_member_permissions).join(', ')}`);
  }
  if (data.examples?.length) {
    extras.push(`Examples:\n${data.examples.map((e) => `\`${prefix}${data.name} ${e}\``).join('\n')}`);
  }
  extras.push('Arguments can also be given by name, e.g. `reason:"text"`.');
  embed.addFields({ name: 'More', value: truncated(extras.join('\n'), 1024) });
  return embed;
}

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show what Sylo can do and how to use a command.')
  .setAliases(['commands'])
  .addStringOption((o) => o.setName('topic').setDescription('A category or command name'))
  .setExamples(['', 'moderation', 'warn']);

/** @param {import('../framework/MessageInteraction.js').MessageInteraction} interaction */
export async function execute(interaction) {
  const all = interaction.client.commands;
  const cats = categories(all);
  const prefix = await getPrefix(interaction.guildId);
  const topic = (interaction.options.getString('topic') ?? '').trim().toLowerCase().replace(/^[!/]/, '');

  if (!topic) return interaction.reply({ embeds: [buildOverviewEmbed(cats, prefix)] });

  const cat = cats.find((c) => c.name.toLowerCase() === topic);
  if (cat) return interaction.reply({ embeds: [buildCategoryEmbed(cat, prefix)] });

  const cmd = findCommand(all, topic);
  if (cmd) return interaction.reply({ embeds: [buildCommandEmbed(cmd, prefix)] });

  return interaction.reply({
    content: `I don't know \`${topic}\`. Categories: ${cats.map((c) => `\`${c.name.toLowerCase()}\``).join(', ')}.`,
  });
}
