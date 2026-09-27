// Mention markup. Fluxer uses the same <@id>, <@&id> and <#id> syntax.
import { SNOWFLAKE_RE } from './snowflake.js';

export const userMention = (id) => `<@${id}>`;
export const roleMention = (id) => `<@&${id}>`;
export const channelMention = (id) => `<#${id}>`;

const USER_RE = /^<@!?(\d{17,20})>$/;
const ROLE_RE = /^<@&(\d{17,20})>$/;
const CHANNEL_RE = /^<#(\d{17,20})>$/;

/** @param {RegExp} re */
function parser(re) {
  return (token) => {
    const t = String(token ?? '').trim();
    const m = re.exec(t);
    if (m) return m[1];
    return SNOWFLAKE_RE.test(t) ? t : null;
  };
}

/** Id from `<@id>`, `<@!id>` or a bare id; null otherwise. */
export const parseUserId = parser(USER_RE);
/** Id from `<@&id>` or a bare id; null otherwise. */
export const parseRoleId = parser(ROLE_RE);
/** Id from `<#id>` or a bare id; null otherwise. */
export const parseChannelId = parser(CHANNEL_RE);
