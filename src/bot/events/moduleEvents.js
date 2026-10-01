// Bridges Fluxer gateway events to the module dispatch layer. Each listener
// forwards (eventName, guildId, payload) to dispatch(), which calls every
// enabled module's handler for that guild. Payloads keep the shapes modules
// were written against (e.g. `{ old, new }` pairs, `{ reaction, user }`), so
// the SDK's differing event signatures are adapted here, not in each module.
import { Events } from '../../platform/index.js';
import { trackVoiceStates } from '../../platform/voiceStates.js';
import { withGuildId } from '../../platform/compat.js';
import { dispatch } from '../../modules/dispatch.js';
import { handleRoleReaction } from '../../modules/messageCreator.js';
import '../../modules/index.js'; // side-effect: registers module handlers

/**
 * A reaction whose `message` is guaranteed to be a full Message with its
 * guildId: Fluxer's `reaction.message` reads the message cache and is null for
 * uncached messages, and a message the bot sent itself is cached from the REST
 * response, which carries no guild_id — so `message.guild` would be null.
 */
export async function withMessage(client, reaction, message) {
  const msg = withGuildId(client, message ?? reaction.message ?? (await reaction.fetchMessage()));
  return Object.create(reaction, { message: { value: msg, enumerable: true } });
}

/**
 * A leaving member with a complete user. Fluxer's GUILD_MEMBER_REMOVE carries
 * only the user id, so a member Sylo hadn't cached arrives with a bare user
 * (no username) and {user.tag} in a leave message reads "undefined".
 */
export async function withFullUser(client, member) {
  if (!member?.user || member.user.username) return member;
  const user = await client.users.fetch(member.id, { force: true }).catch(() => null);
  return user ? Object.create(member, { user: { value: user, enumerable: true } }) : member;
}

/** @param {import('@fluxerjs/core').Client} client */
export function register(client) {
  client.on(Events.GuildMemberAdd, (member) => dispatch('guildMemberAdd', member.guild?.id, member));
  client.on(Events.GuildMemberRemove, async (member) => {
    dispatch('guildMemberRemove', member.guild?.id, await withFullUser(client, member));
  });
  client.on(Events.GuildMemberUpdate, (oldM, newM) =>
    dispatch('guildMemberUpdate', newM.guild?.id, { old: oldM ?? newM, new: newM })
  );

  client.on(Events.GuildBanAdd, (ban) => dispatch('guildBanAdd', ban.guildId, ban));
  client.on(Events.GuildBanRemove, (ban) => dispatch('guildBanRemove', ban.guildId, ban));

  trackVoiceStates(client, (oldState, newState) =>
    dispatch('voiceStateUpdate', newState.guildId, { old: oldState, new: newState })
  );

  client.on(Events.MessageDelete, (message) => {
    if (message.guildId) dispatch('messageDelete', message.guildId, message);
  });
  client.on(Events.MessageDeleteBulk, ({ ids, channelId, guildId }) => {
    if (!guildId) return;
    const channel = client.channels.get(channelId) ?? null;
    const messages = new Map(ids.map((id) => [id, { id, channelId, guildId, partial: true }]));
    dispatch('messageDeleteBulk', guildId, { messages, channel });
  });
  client.on(Events.MessageUpdate, (oldMsg, newMsg) => {
    if (newMsg.guildId) dispatch('messageUpdate', newMsg.guildId, { old: oldMsg, new: newMsg });
  });
  client.on(Events.MessageCreate, (message) => {
    if (!message.guildId) return;
    // `messageCreateAny` also carries bot / app / webhook messages — only the
    // sticky module opts into those. `messageCreate` stays human-only.
    dispatch('messageCreateAny', message.guildId, message);
    if (!message.author?.bot) dispatch('messageCreate', message.guildId, message);
  });

  client.on(Events.GuildRoleCreate, (role) => dispatch('roleCreate', role.guildId, role));
  client.on(Events.GuildRoleDelete, (role, guildId, roleId) =>
    dispatch('roleDelete', guildId, role ?? { id: roleId, guildId, name: null })
  );

  client.on(Events.InviteCreate, (invite) => dispatch('inviteCreate', invite.guildSnapshot?.id, invite));
  client.on(Events.InviteDelete, (payload) => dispatch('inviteDelete', payload.guildId, payload));
  client.on(Events.GuildCreate, (guild) => dispatch('guildCreate', guild.id, guild));

  client.on(Events.ChannelCreate, (channel) => {
    if (channel.guildId) dispatch('channelCreate', channel.guildId, channel);
  });
  client.on(Events.ChannelDelete, (channel) => {
    if (channel.guildId) dispatch('channelDelete', channel.guildId, channel);
  });

  const forwardReaction = (event) => async (payload) => {
    const guildId = payload.reaction?.guildId ?? payload.message?.guildId;
    if (!guildId) return;
    let reaction;
    try {
      reaction = await withMessage(client, payload.reaction, payload.message);
    } catch {
      return; // message deleted or not visible to the bot
    }
    const user = payload.user ?? (await client.users.fetch(payload.userId).catch(() => null));
    if (!user) return;
    // Role reactions on composed messages work regardless of which module
    // posted them, so they're handled here rather than through dispatch().
    await handleRoleReaction(event === 'reactionAdd' ? 'add' : 'remove', { reaction, user }).catch(() => {});
    dispatch(event, guildId, { reaction, user });
  };
  client.on(Events.MessageReactionAdd, forwardReaction('reactionAdd'));
  client.on(Events.MessageReactionRemove, forwardReaction('reactionRemove'));
}
