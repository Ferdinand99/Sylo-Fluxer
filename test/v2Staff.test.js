// The V2 staff API (src/web/routes/v2Staff.js): commands, appeals review, the
// moderation hub and the ticket inbox. Runs against the real Express app with a
// faked guild, in open mode (no login), like the other route tests.
import { startWebApp } from './helpers/webApp.js';
import { GID, CH, ROLE } from './helpers/fakeGuild.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppeal } from '../src/db/appeals.js';
import { createTicket, addTicketMessage, getTicket } from '../src/db/tickets.js';

let app;
test.before(async () => {
  app = await startWebApp();
});
test.after(() => app.close());

const api = (path, body) =>
  fetch(`${app.base}/api/v2/guilds/${GID}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const json = async (res) => res.json();

// --- commands -------------------------------------------------------------------

test('GET /commands lists the bot commands with channels and roles to pick from', async () => {
  const res = await api('/commands');
  assert.equal(res.status, 200);
  const d = await json(res);
  assert.deepEqual(
    d.commands.map((c) => c.name),
    ['ban', 'ping']
  );
  assert.ok(d.commands.every((c) => c.enabled && c.allowedChannels.length === 0));
  assert.ok(d.channels.some((c) => c.id === CH.general));
  assert.ok(!d.roles.some((r) => r.id === GID), '@everyone is not offered as a role');
  assert.ok(d.roles.some((r) => r.id === ROLE.member));
});

test('POST /commands/:name saves limits, drops malformed ids, and rejects unknown commands', async () => {
  const ok = await api('/commands/ping', {
    enabled: false,
    channels: [CH.general, 'nope'],
    roles: [ROLE.member],
  });
  assert.equal(ok.status, 200);
  const saved = (await json(ok)).command;
  assert.deepEqual(saved, {
    name: 'ping',
    enabled: false,
    allowedChannels: [CH.general],
    allowedRoles: [ROLE.member],
  });

  const again = (await json(await api('/commands'))).commands.find((c) => c.name === 'ping');
  assert.equal(again.enabled, false);
  assert.deepEqual(again.allowedChannels, [CH.general]);

  const unknown = await api('/commands/not-a-command', { enabled: true });
  assert.equal(unknown.status, 404);
});

// --- moderation hub ---------------------------------------------------------------

test('GET /moderation returns cases, bans, temp bans and locks', async () => {
  const d = await json(await api('/moderation'));
  for (const key of ['cases', 'bans', 'tempBans', 'channelLocks']) assert.ok(Array.isArray(d[key]), key);
  assert.equal(d.lockdownActive, false);
  assert.equal(d.bansError, null);
});

test('warning a member makes a case that can be edited, deleted and restored', async () => {
  const userId = '700000000000000001';
  const bad = await api('/moderation/warn', { userId, reason: '' });
  assert.equal(bad.status, 400);

  const warn = await api('/moderation/warn', { userId, reason: 'spamming links' });
  assert.equal(warn.status, 200);
  assert.equal((await json(warn)).warnings, 1);

  const mod = await json(await api('/moderation'));
  const c = mod.cases.find((x) => x.userId === userId);
  assert.ok(c, 'the warning shows up as a case');
  assert.equal(c.reason, 'spamming links');
  assert.equal(c.active, true);

  const edit = await api(`/moderation/cases/${c.caseNumber}/reason`, { reason: 'spam' });
  assert.equal(edit.status, 200);
  const del = await api(`/moderation/cases/${c.caseNumber}/delete`, {});
  assert.equal((await json(del)).active, false);
  const gone = (await json(await api('/moderation'))).cases.find((x) => x.caseNumber === c.caseNumber);
  assert.equal(gone.reason, 'spam');
  assert.equal(gone.active, false);
  const back = await api(`/moderation/cases/${c.caseNumber}/restore`, {});
  assert.equal((await json(back)).active, true);

  assert.equal((await api('/moderation/cases/9999/delete', {})).status, 404);
  assert.equal((await api(`/moderation/cases/${c.caseNumber}/explode`, {})).status, 404);

  const cleared = await api('/moderation/warnings/clear', { userId });
  assert.equal(cleared.status, 200);
  assert.equal((await api('/moderation/warnings/clear', { userId })).status, 404, 'nothing left to clear');
});

test('unban says so when the user is not banned, and rejects a bad id', async () => {
  assert.equal((await api('/moderation/unban', { userId: 'not an id' })).status, 400);
  const res = await api('/moderation/unban', { userId: '700000000000000002' });
  assert.equal(res.status, 404);
  assert.match((await json(res)).error, /not banned/i);
});

test('unlock-channel rejects a channel that is not locked', async () => {
  const res = await api('/moderation/unlock-channel', { channelId: CH.general });
  assert.equal(res.status, 404);
});

// --- appeals ---------------------------------------------------------------------

test('appeals review lists an open appeal, decides it once, then refuses a second decision', async () => {
  const userId = '700000000000000003';
  await createAppeal(GID, {
    userId,
    userTag: 'appealer',
    banReason: 'spam',
    answers: [{ q: 'Why were you banned?', a: 'a misunderstanding' }],
  });

  const list = await json(await api('/appeals'));
  const a = list.appeals.find((x) => x.userId === userId);
  assert.ok(a);
  assert.equal(a.status, 'open');
  assert.deepEqual(a.answers, [{ q: 'Why were you banned?', a: 'a misunderstanding' }]);
  assert.ok(list.open >= 1);

  assert.equal((await api(`/appeals/${a.id}/decide`, { decision: 'maybe' })).status, 400);
  const denied = await api(`/appeals/${a.id}/decide`, { decision: 'deny', reason: 'not this time' });
  assert.equal(denied.status, 200);
  assert.equal((await json(denied)).status, 'denied');

  const after = (await json(await api('/appeals'))).appeals.find((x) => x.id === a.id);
  assert.equal(after.status, 'denied');
  assert.equal(after.decisionReason, 'not this time');

  const twice = await api(`/appeals/${a.id}/decide`, { decision: 'accept' });
  assert.equal(twice.status, 409);
});

// --- tickets ---------------------------------------------------------------------

test('ticket inbox, conversation, reply, poll, transcript and close', async () => {
  const userId = '700000000000000004';
  const t = await createTicket(GID, userId);
  await addTicketMessage(t.id, { authorId: userId, authorKind: 'user', content: 'hello, I need help' });

  const inbox = await json(await api('/tickets'));
  const row = inbox.open.find((x) => x.id === t.id);
  assert.ok(row, 'open ticket is listed');
  assert.equal(row.preview, 'hello, I need help');

  const view = await json(await api(`/tickets/${t.id}`));
  assert.equal(view.ticket.status, 'open');
  assert.equal(view.messages.length, 1);
  assert.equal(view.messages[0].kind, 'user');

  assert.equal((await api(`/tickets/${t.id}/reply`, { content: '   ' })).status, 400);
  const reply = await api(`/tickets/${t.id}/reply`, { content: 'we are on it' });
  assert.equal(reply.status, 200);
  assert.equal((await json(reply)).delivered, true);

  const poll = await json(await api(`/tickets/${t.id}/messages?after=${view.lastId}`));
  assert.deepEqual(
    poll.messages.map((m) => [m.kind, m.content]),
    [['staff', 'we are on it']]
  );

  const transcript = await fetch(`${app.base}/api/v2/guilds/${GID}/tickets/${t.id}/transcript`);
  assert.equal(transcript.status, 200);
  assert.match(transcript.headers.get('content-disposition'), /attachment/);

  const closed = await api(`/tickets/${t.id}/close`, { content: 'all done' });
  assert.equal(closed.status, 200);
  assert.equal((await getTicket(t.id)).status, 'closed');
  assert.equal((await api(`/tickets/${t.id}/reply`, { content: 'late' })).status, 409);
  const after = await json(await api('/tickets'));
  assert.ok(after.closed.some((x) => x.id === t.id));
});

test('a ticket from another server is not reachable', async () => {
  const other = await createTicket('800000000000000999', '700000000000000005');
  assert.equal((await api(`/tickets/${other.id}`)).status, 404);
  assert.equal((await api(`/tickets/${other.id}/reply`, { content: 'hi' })).status, 404);
});

// --- automod immunity roles ----------------------------------------------------

test('immunity roles are saved on their own and survive saving the automod rules', async () => {
  const get = async () => json(await api('/modules/automod/config'));

  const first = await get();
  assert.ok(
    first.roles.some((r) => r.id === ROLE.member),
    'roles are offered to pick from'
  );
  assert.deepEqual(first.config.exemptRoles, []);

  const saved = await api('/modules/automod/immunity', { exemptRoles: [ROLE.member, 'junk'] });
  assert.equal(saved.status, 200);
  assert.deepEqual((await json(saved)).exemptRoles, [ROLE.member]);
  assert.deepEqual((await get()).config.exemptRoles, [ROLE.member]);

  // Saving the main automod form must not wipe them.
  const rules = await api('/modules/automod/config', { timeoutMinutes: 15, exemptChannels: [], rules: {} });
  assert.equal(rules.status, 200);
  assert.deepEqual((await get()).config.exemptRoles, [ROLE.member]);

  const cleared = await api('/modules/automod/immunity', { exemptRoles: [] });
  assert.deepEqual((await json(cleared)).exemptRoles, []);
});
