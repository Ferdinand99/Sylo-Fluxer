// Permission flags. Fluxer's bit positions match the ones Sylo has always used
// (Administrator = 1<<3, ManageGuild = 1<<5, ModerateMembers = 1<<40, …), so
// stored bitfields and the bot-invite permission integer carry over unchanged.
// Discord-only flags (thread permissions, application commands, events) do not
// exist here.
import { PermissionFlags, PermissionsBitField } from '@fluxerjs/core';

/** discord.js-compatible name for Fluxer's flag map. */
export const PermissionFlagsBits = PermissionFlags;

export { PermissionsBitField };

/**
 * Human-readable names of the flags set in `bits`, e.g. for "you are missing …".
 * @param {bigint | string | number} bits
 * @returns {string[]}
 */
export function permissionNames(bits) {
  const value = BigInt(bits ?? 0);
  return Object.entries(PermissionFlags)
    .filter(([, bit]) => (value & bit) === bit && bit !== 0n)
    .map(([name]) => name.replace(/([a-z])([A-Z])/g, '$1 $2'));
}
