// !prefix [new] — show or change this server's command prefix. Changing it
// needs Manage Server; `!prefix reset` goes back to the default.
import { SlashCommandBuilder, InteractionContextType } from '../framework/CommandBuilder.js';
import { PermissionFlagsBits, MessageFlags } from '../../platform/index.js';
import { getPrefix, setPrefix, prefixError, DEFAULT_PREFIX } from '../../db/guildSettings.js';
import { recordAudit } from '../../db/audit.js';

export const data = new SlashCommandBuilder()
  .setName('prefix')
  .setDescription("Show or change this server's command prefix.")
  .setContexts(InteractionContextType.Guild)
  .addStringOption((o) =>
    o.setName('new').setDescription('The new prefix (1–5 characters), or "reset"').setMaxLength(5)
  )
  .setExamples(['', '?', 'reset']);

/** @param {import('../framework/MessageInteraction.js').MessageInteraction} interaction */
export async function execute(interaction) {
  const current = await getPrefix(interaction.guildId);
  const next = interaction.options.getString('new');

  if (!next) {
    return interaction.reply(
      `The prefix here is \`${current}\` — e.g. \`${current}help\`. You can also mention me.`
    );
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: '⚠️ You need **Manage Server** to change the prefix.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const value = next.toLowerCase() === 'reset' ? DEFAULT_PREFIX : next;
  const err = prefixError(value);
  if (err) return interaction.reply({ content: `⚠️ ${err}`, flags: MessageFlags.Ephemeral });

  await setPrefix(interaction.guildId, value);
  await recordAudit(interaction.guildId, {
    actor: interaction.user.username,
    action: 'settings:prefix',
    detail: `prefix set to ${value}`,
  });
  return interaction.reply(`✅ Prefix set to \`${value}\` — e.g. \`${value}help\`.`);
}
