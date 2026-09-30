// !version — report the release of Sylo this instance is running.
import { SlashCommandBuilder } from '../framework/CommandBuilder.js';
import { MessageFlags } from '../../platform/index.js';
import { BUILD } from '../lib/buildInfo.js';

export const data = new SlashCommandBuilder()
  .setName('version')
  .setDescription('Show the version of Sylo this server is running.');

/** @param {import('../framework/MessageInteraction.js').MessageInteraction} interaction */
export async function execute(interaction) {
  await interaction.reply({
    content: `Sylo **v${BUILD.version}**`,
    flags: MessageFlags.Ephemeral,
  });
}
