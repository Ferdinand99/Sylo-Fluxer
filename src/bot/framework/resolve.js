// Turn parsed user / channel / role references ({ ref: id-or-name }) into SDK
// objects for the MessageInteraction adapter.
import { OptionType } from './CommandBuilder.js';

const SNOWFLAKE = /^\d{17,20}$/;
const norm = (s) => String(s ?? '').toLowerCase();

async function findMember(guild, ref) {
  if (!guild) return null;
  if (SNOWFLAKE.test(ref)) {
    return guild.members.get(ref) ?? (await guild.members.fetch(ref).catch(() => null));
  }
  const q = norm(ref);
  const match = (m) =>
    norm(m.user?.username) === q ||
    norm(m.nick) === q ||
    norm(m.displayName) === q ||
    norm(m.user?.tag) === q;
  const cached = [...guild.members.values()].find(match);
  if (cached) return cached;
  const res = await guild.members.search({ query: ref, limit: 5 }).catch(() => null);
  const hit = (res?.members ?? []).find(
    (h) => norm(h.username) === q || norm(h.nickname) === q || norm(h.globalName) === q
  );
  return hit ? await guild.members.fetch(hit.userId).catch(() => null) : null;
}

/**
 * Resolve every reference-typed value in place. Returns user-facing errors for
 * references that don't exist.
 * @param {import('@fluxerjs/core').Message} message
 * @param {object[]} options  the (sub)command's option builders
 * @param {Map<string, any>} values  from parseArgs; replaced with resolved entries
 * @returns {Promise<{ resolved: Map<string, any>, errors: string[] }>}
 */
export async function resolveValues(message, options, values) {
  const errors = [];
  const resolved = new Map();
  const guild = message.guild;
  const client = message.client;

  for (const opt of options) {
    if (!values.has(opt.name)) continue;
    const raw = values.get(opt.name);

    if (opt.type === OptionType.User) {
      const member = await findMember(guild, raw.ref);
      let user = member?.user ?? null;
      if (!user && SNOWFLAKE.test(raw.ref)) user = await client.users.fetch(raw.ref).catch(() => null);
      if (!user) {
        errors.push(`I couldn't find the member \`${raw.ref}\`.`);
        continue;
      }
      resolved.set(opt.name, { user, member });
    } else if (opt.type === OptionType.Channel) {
      let channel = null;
      if (SNOWFLAKE.test(raw.ref)) {
        channel = guild?.channels.get(raw.ref) ?? (await client.channels.fetch(raw.ref).catch(() => null));
        if (channel && guild && channel.guildId !== guild.id) channel = null;
      } else if (guild) {
        channel = [...guild.channels.values()].find((c) => norm(c.name) === norm(raw.ref)) ?? null;
      }
      if (!channel) {
        errors.push(`I couldn't find the channel \`${raw.ref}\`.`);
        continue;
      }
      if (opt.channel_types?.length && !opt.channel_types.includes(channel.type)) {
        errors.push(`\`${opt.name}\` must be a different kind of channel than <#${channel.id}>.`);
        continue;
      }
      resolved.set(opt.name, { channel });
    } else if (opt.type === OptionType.Role) {
      let role = null;
      if (guild) {
        role = SNOWFLAKE.test(raw.ref)
          ? (guild.roles.get(raw.ref) ?? null)
          : ([...guild.roles.values()].find((r) => norm(r.name) === norm(raw.ref)) ??
            (norm(raw.ref) === 'everyone' ? guild.roles.everyone : null));
      }
      if (!role) {
        errors.push(`I couldn't find the role \`${raw.ref}\`.`);
        continue;
      }
      resolved.set(opt.name, { role });
    } else {
      resolved.set(opt.name, { value: raw });
    }
  }
  return { resolved, errors };
}
