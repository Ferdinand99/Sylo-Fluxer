// /ping — basic health check. Reports gateway heartbeat and round-trip latency.
import { SlashCommandBuilder } from '../framework/CommandBuilder.js';
import { MessageFlags } from '../../platform/index.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check that Sylo is alive and see its latency.');

/** @param {import('../framework/MessageInteraction.js').MessageInteraction} interaction */
export async function execute(interaction) {
  const sent = await interaction.reply({
    content: 'Pinging…',
    flags: MessageFlags.Ephemeral,
    withResponse: true,
  });

  const roundTrip = sent.resource.message.createdTimestamp - interaction.createdTimestamp;
  const heartbeat = Math.round(interaction.client.ws.ping);

  await interaction.editReply(
    `Pong! Round-trip: **${roundTrip}ms** · Gateway heartbeat: **${heartbeat < 0 ? 'n/a' : `${heartbeat}ms`}**`
  );
}
