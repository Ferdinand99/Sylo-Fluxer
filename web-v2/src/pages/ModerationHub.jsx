import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getModeration,
  unbanMember,
  lockAllChannels,
  unlockAllChannels,
  unlockChannel,
  warnMember,
  clearMemberWarnings,
  editCaseReason,
  setCaseDeleted,
} from '../api.js';
import { useApiData } from '../useApiData.js';
import { notify } from '../notify.js';
import LoadError from '../components/LoadError.jsx';
import Meta, { plural } from '../components/Meta.jsx';

const TABS = [
  ['cases', 'Cases'],
  ['bans', 'Bans'],
  ['locks', 'Lockdown'],
];

// Runs an action, shows its outcome as a toast, and reloads the lists after a success.
function useAction(reload) {
  const [busy, setBusy] = useState(false);
  async function run(fn, okMessage) {
    setBusy(true);
    try {
      const r = await fn();
      if (okMessage) notify(typeof okMessage === 'function' ? okMessage(r) : okMessage, 'info');
      await reload();
      return r;
    } catch (err) {
      notify(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

function WarnPanel({ guildId, run, busy }) {
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');

  async function warn(e) {
    e.preventDefault();
    const r = await run(
      () => warnMember(guildId, userId, reason),
      (res) =>
        `Warned. They now have ${plural(res.warnings, 'warning')}.${res.dmDelivered ? '' : ' They could not be sent a DM.'}`
    );
    if (r) setReason('');
  }
  async function clear() {
    if (!userId.trim()) return notify('Enter a user ID or mention first.');
    if (!confirm('Clear every warning for this member?')) return;
    await run(
      () => clearMemberWarnings(guildId, userId),
      (res) => `Removed ${plural(res.removed, 'warning')}.`
    );
  }

  return (
    <form className="v2-rule-card" onSubmit={warn}>
      <h2 className="v2-group-title">Warn a member</h2>
      <div className="v2-field-row">
        <input
          type="text"
          aria-label="User ID or mention"
          placeholder="User ID or @mention"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
        />
        <input
          type="text"
          aria-label="Reason"
          placeholder="Reason"
          maxLength={400}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="v2-field-row v2-section-gap-sm">
        <button type="submit" className="v2-btn-primary" disabled={busy || !reason.trim()}>
          Warn
        </button>
        <button type="button" className="v2-btn-ghost" disabled={busy} onClick={clear}>
          Clear their warnings
        </button>
      </div>
      <p className="v2-field-hint">
        A warning is saved as a case, sent to the member by DM, and counted toward the warning thresholds in
        the moderation settings.
      </p>
    </form>
  );
}

function CaseRow({ c, guildId, run, busy }) {
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState(c.reason ?? '');

  async function saveReason() {
    const r = await run(() => editCaseReason(guildId, c.caseNumber, reason), 'Reason updated.');
    if (r) setEditing(false);
  }

  return (
    <div className={`v2-row v2-case-row${c.active ? '' : ' is-deleted'}`}>
      <div className="v2-row-main">
        <h3>
          <span className="v2-id">#{c.caseNumber}</span>
          {c.user}
          <span className="v2-case-action">{c.action}</span>
          {!c.active ? <span className="v2-case-action">deleted</span> : null}
        </h3>
        {editing ? (
          <div className="v2-field-row">
            <input
              type="text"
              aria-label={`Reason for case ${c.caseNumber}`}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              type="button"
              className="v2-btn-primary"
              disabled={busy || !reason.trim()}
              onClick={saveReason}
            >
              Save
            </button>
            <button type="button" className="v2-btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <p className="v2-case-reason">
            <Meta items={[c.reason || 'No reason', c.detail, `by ${c.moderator}`, c.ago]} />
          </p>
        )}
      </div>
      {!editing ? (
        <div className="v2-field-row">
          <button type="button" className="v2-btn-ghost" disabled={busy} onClick={() => setEditing(true)}>
            Edit reason
          </button>
          <button
            type="button"
            className="v2-btn-ghost"
            disabled={busy}
            onClick={() =>
              run(
                () => setCaseDeleted(guildId, c.caseNumber, c.active),
                c.active ? `Case #${c.caseNumber} deleted.` : `Case #${c.caseNumber} restored.`
              )
            }
          >
            {c.active ? 'Delete' : 'Restore'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function ModerationHub() {
  const { guildId } = useParams();
  const { data, loading, error, setData } = useApiData(() => getModeration(guildId), [guildId]);
  const [tab, setTab] = useState('cases');
  const reload = async () => setData(await getModeration(guildId));
  const { busy, run } = useAction(reload);

  if (loading && !data) return <p className="v2-state">Loading…</p>;
  if (error) return <LoadError error={error} what="the moderation page" />;

  return (
    <>
      <h1 className="v2-section-title">Moderation</h1>
      <p className="v2-field-hint">
        Cases, bans and lockdown for this server. Warning thresholds, the mod-log and auto-moderation are in
        the <Link to={`/guilds/${guildId}/m/moderation`}>moderation settings</Link>.
      </p>

      <WarnPanel guildId={guildId} run={run} busy={busy} />

      <div className="v2-tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`v2-tab${tab === key ? ' is-active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'cases' ? (
        data.cases.length ? (
          <>
            <p className="v2-field-hint">
              Showing the newest {data.cases.length} of {data.caseTotal}.
            </p>
            <div className="v2-list">
              {data.cases.map((c) => (
                <CaseRow key={c.caseNumber} c={c} guildId={guildId} run={run} busy={busy} />
              ))}
            </div>
          </>
        ) : (
          <p className="v2-field-hint">No cases yet.</p>
        )
      ) : null}

      {tab === 'bans' ? (
        <>
          {data.bansError ? <p className="v2-note">{data.bansError}</p> : null}
          <h2 className="v2-group-title">Banned ({data.bansTotal})</h2>
          {data.bans.length ? (
            <div className="v2-list">
              {data.bans.map((b) => (
                <div className="v2-row" key={b.id}>
                  <div className="v2-row-main">
                    <h3>{b.tag}</h3>
                    <p>
                      <Meta items={[b.id, b.reason]} />
                    </p>
                  </div>
                  <button
                    type="button"
                    className="v2-btn-ghost"
                    disabled={busy}
                    onClick={() => run(() => unbanMember(guildId, b.id), `${b.tag} unbanned.`)}
                  >
                    Unban
                  </button>
                </div>
              ))}
            </div>
          ) : !data.bansError ? (
            <p className="v2-field-hint">Nobody is banned.</p>
          ) : null}
          {data.bansTotal > data.bans.length ? (
            <p className="v2-field-hint">Showing the first {data.banLimit} bans.</p>
          ) : null}

          <h2 className="v2-group-title v2-section-gap">Temporary bans ({data.tempBans.length})</h2>
          {data.tempBans.length ? (
            <div className="v2-list">
              {data.tempBans.map((t) => (
                <div className="v2-row" key={t.userId}>
                  <div className="v2-row-main">
                    <h3>{t.tag}</h3>
                    <p>
                      <Meta items={[`unbanned in ${t.remaining}`, t.reason]} />
                    </p>
                  </div>
                  <button
                    type="button"
                    className="v2-btn-ghost"
                    disabled={busy}
                    onClick={() => run(() => unbanMember(guildId, t.userId), `${t.tag} unbanned.`)}
                  >
                    Unban now
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="v2-field-hint">No scheduled unbans.</p>
          )}
        </>
      ) : null}

      {tab === 'locks' ? (
        <>
          <div className="v2-field-row">
            <button
              type="button"
              className="v2-btn-primary"
              disabled={busy}
              onClick={() => {
                if (confirm('Lock every text channel in this server?'))
                  run(
                    () => lockAllChannels(guildId),
                    (r) => `Locked ${plural(r.locked, 'channel')}.`
                  );
              }}
            >
              Lock all channels
            </button>
            <button
              type="button"
              className="v2-btn-ghost"
              disabled={busy || !data.lockdownActive}
              onClick={() =>
                run(
                  () => unlockAllChannels(guildId),
                  (r) => `Unlocked ${plural(r.unlocked, 'channel')}.`
                )
              }
            >
              End lockdown
            </button>
          </div>
          <h2 className="v2-group-title v2-section-gap">Locked channels ({data.channelLocks.length})</h2>
          {data.channelLocks.length ? (
            <div className="v2-list">
              {data.channelLocks.map((l) => (
                <div className="v2-row" key={l.channelId}>
                  <div className="v2-row-main">
                    <h3>#{l.name ?? 'deleted channel'}</h3>
                    <p>
                      <Meta
                        items={[
                          l.lockdown ? 'part of a lockdown' : 'locked on its own',
                          `by ${l.lockedBy}`,
                          l.ago,
                        ]}
                      />
                    </p>
                  </div>
                  <button
                    type="button"
                    className="v2-btn-ghost"
                    disabled={busy}
                    onClick={() => run(() => unlockChannel(guildId, l.channelId), 'Channel unlocked.')}
                  >
                    Unlock
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="v2-field-hint">No channels are locked.</p>
          )}
        </>
      ) : null}
    </>
  );
}
