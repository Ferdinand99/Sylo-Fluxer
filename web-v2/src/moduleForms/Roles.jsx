import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getRoles, saveAutoroles, saveReactionRole, deleteReactionRole, ApiError } from '../api.js';
import ChipPicker from '../components/ChipPicker.jsx';
import EmbedEditor from '../components/EmbedEditor.jsx';
import { newKey } from '../components/EmbedCard.jsx';
import { notify } from '../notify.js';
import Meta, { plural } from '../components/Meta.jsx';

function blankRow() {
  return { key: newKey('r'), emoji: '', label: '', roleId: '', btnStyle: 'secondary' };
}

// Fluxer has no buttons or select menus, so every set publishes as reactions.
// Sets saved with an older style keep it (their rows may have no emoji and get a
// numbered keycap), but the form no longer offers a choice.
function rowsMeta(style) {
  return style === 'reaction' ? { max: 20 } : { max: 25 };
}

function ReactionRoleForm({ initial, channels, roles, onSave, onCancel, saving }) {
  const style = initial.style || 'reaction';
  const [channelId, setChannelId] = useState(initial.channelId || '');
  const [message, setMessage] = useState(initial.message || '');
  const [embedSpec, setEmbedSpec] = useState(initial.embed || {});
  const [exclusive, setExclusive] = useState(Boolean(initial.exclusive));
  const [mode, setMode] = useState(initial.mode === 'reverse' ? 'reverse' : 'default');
  // Not editable any more (Fluxer has no select menus); passed through so saving keeps them.
  const { placeholder = '', selMin = 0, selMax = 0 } = initial;
  const [rows, setRows] = useState(() => {
    const pairs = Array.isArray(initial.pairs) && initial.pairs.length ? initial.pairs : [{}];
    return pairs.map((p) => ({
      key: newKey('r'),
      emoji: p.display || '',
      label: p.label || '',
      roleId: p.roleId ? String(p.roleId) : '',
      btnStyle: p.btnStyle || 'secondary',
    }));
  });

  const meta = rowsMeta(style);

  function updateRow(key, patch) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow() {
    if (rows.length < meta.max) setRows((rs) => [...rs, blankRow()]);
  }
  function removeRow(key) {
    setRows((rs) => {
      const next = rs.filter((r) => r.key !== key);
      return next.length ? next : [blankRow()];
    });
  }

  function submit(e) {
    e.preventDefault();
    onSave({
      id: initial.id || '',
      channelId,
      style,
      message,
      embed: embedSpec,
      exclusive,
      mode,
      placeholder,
      selMin,
      selMax,
      pairs: rows.map((r) => ({ emoji: r.emoji, label: r.label, roleId: r.roleId, btnStyle: r.btnStyle })),
    });
  }

  return (
    <form onSubmit={submit} className="v2-section-gap">
      {style !== 'reaction' ? (
        <p className="v2-note">
          This set was made with the old {style === 'select' ? 'dropdown' : 'button'} style. Fluxer has no{' '}
          {style === 'select' ? 'select menus' : 'buttons'}, so it is published as reactions; rows without an
          emoji get a numbered one.
        </p>
      ) : null}

      <div className="v2-field">
        <label>Channel</label>
        <select value={channelId} onChange={(e) => setChannelId(e.target.value)} required>
          <option value="">— select a channel —</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="v2-field">
        <label>
          Message text <span className="v2-field-hint">— optional, above the embed</span>
        </label>
        <textarea
          rows={2}
          placeholder="Pick your roles below!"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      <EmbedEditor spec={embedSpec} onChange={setEmbedSpec} />

      <div className="v2-field u-mt-2">
        <label className="v2-check">
          <input type="checkbox" checked={exclusive} onChange={(e) => setExclusive(e.target.checked)} />
          Only one role from this set at a time (picking one removes the others)
        </label>
      </div>

      <div className="v2-field">
        <label>
          Reactions and roles{' '}
          <span className="v2-field-hint">
            ({rows.length} / {meta.max})
          </span>
        </label>
        {rows.map((row) => (
          <div className="v2-field-row" key={row.key}>
            <input
              type="text"
              placeholder={style === 'reaction' ? 'Emoji (required)' : 'Emoji (optional)'}
              value={row.emoji}
              onChange={(e) => updateRow(row.key, { emoji: e.target.value })}
              style={{ maxWidth: '110px' }}
            />
            <select value={row.roleId} onChange={(e) => updateRow(row.key, { roleId: e.target.value })}>
              <option value="">— select a role —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button type="button" className="v2-embed-x" onClick={() => removeRow(row.key)} title="Remove">
              ×
            </button>
          </div>
        ))}
        <button type="button" className="v2-btn-ghost" disabled={rows.length >= meta.max} onClick={addRow}>
          + Add reaction
        </button>
      </div>

      <div className="v2-field">
        <label>Reaction mode</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="default">
            Default: reacting adds the role, removing the reaction takes it away.
          </option>
          <option value="reverse">
            Reverse: reacting removes the role (opt-out), removing the reaction gives it back.
          </option>
        </select>
      </div>

      <div className="v2-field-row">
        <button type="submit" className="v2-btn-primary" disabled={saving}>
          {saving ? 'Publishing…' : 'Publish'}
        </button>
        <button type="button" className="v2-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Roles() {
  const { guildId } = useParams();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [autoroles, setAutoroles] = useState([]);
  const [savingAutoroles, setSavingAutoroles] = useState(false);
  const [autorolesSaved, setAutorolesSaved] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  function load() {
    return getRoles(guildId)
      .then((data) => {
        setState({ loading: false, data, error: null });
        setAutoroles(data.autoroles);
      })
      .catch((error) => setState({ loading: false, data: null, error }));
  }

  useEffect(() => {
    load();
  }, [guildId]);

  if (state.loading) return <p className="v2-state">Loading…</p>;
  if (state.error) {
    const notAuthed = state.error instanceof ApiError && state.error.notAuthenticated;
    return (
      <p className="v2-state">
        {notAuthed ? (
          <>
            Your session expired — <a href="/auth/fluxer/login">log in again</a>.
          </>
        ) : (
          `Couldn't load Reaction roles settings (${state.error.message}).`
        )}
      </p>
    );
  }

  const d = state.data;

  async function onSaveAutoroles(e) {
    e.preventDefault();
    setSavingAutoroles(true);
    setAutorolesSaved(false);
    try {
      await saveAutoroles(guildId, autoroles);
      setAutorolesSaved(true);
    } catch (err) {
      notify(err.message);
    } finally {
      setSavingAutoroles(false);
    }
  }

  async function onSaveRr(body) {
    setSaving(true);
    try {
      const { error } = await saveReactionRole(guildId, body);
      setCreating(false);
      setEditingId(null);
      setNotice(error || null);
      await load();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id) {
    if (!confirm('Delete this reaction-role set and its message?')) return;
    try {
      await deleteReactionRole(guildId, id);
      await load();
    } catch (err) {
      setNotice(err.message);
    }
  }

  return (
    <>
      <h1 className="v2-section-title">Reaction roles &amp; autoroles</h1>
      <p className="v2-field-hint">Self-assign roles from a message; roles automatically on join.</p>

      {notice ? <p className="v2-note">{notice}</p> : null}

      <div className="v2-group">
        <h2 className="v2-group-title">Reaction roles ({d.reactionMessages.length})</h2>
        {d.reactionMessages.length === 0 ? (
          <p className="v2-note">None yet — create one to let members self-assign roles.</p>
        ) : (
          <div className="v2-list">
            {d.reactionMessages.map((rm) => {
              const channel = d.channels.find((c) => c.id === rm.channelId);
              const title = rm.embed?.title || (rm.message || '').slice(0, 60) || 'Reaction role';
              const style = rm.style || 'reaction';
              return (
                <div className="v2-row" key={rm.id}>
                  <div className="v2-row-main">
                    <h3>{title}</h3>
                    <p>
                      <Meta
                        items={[
                          `#${channel ? channel.name : rm.channelId}`,
                          plural((rm.pairs || []).length, 'role'),
                          style === 'reaction' ? 'reactions' : `${style} (shown as reactions)`,
                          style !== 'select' && (rm.mode || 'default'),
                          rm.exclusive && 'exclusive',
                        ]}
                      />
                    </p>
                    {editingId === rm.id ? (
                      <ReactionRoleForm
                        initial={rm}
                        channels={d.channels}
                        roles={d.roles}
                        saving={saving}
                        onSave={onSaveRr}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : null}
                  </div>
                  {editingId === rm.id ? null : (
                    <div className="v2-field-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                      <span className={`v2-status-pill ${rm.messageId ? 'completed' : 'pending'}`}>
                        {rm.messageId ? 'published' : 'draft'}
                      </span>
                      <button type="button" className="v2-btn-ghost" onClick={() => setEditingId(rm.id)}>
                        Edit
                      </button>
                      <button type="button" className="v2-btn-ghost" onClick={() => onDelete(rm.id)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {creating ? (
        <div className="v2-group">
          <h2 className="v2-group-title">New reaction role</h2>
          <ReactionRoleForm
            initial={{}}
            channels={d.channels}
            roles={d.roles}
            saving={saving}
            onSave={onSaveRr}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <button type="button" className="v2-btn-primary" onClick={() => setCreating(true)}>
          + New reaction role
        </button>
      )}

      <div className="v2-group v2-section-gap">
        <h2 className="v2-group-title">Autoroles on join</h2>
        <p className="v2-field-hint">Given automatically when a member joins.</p>
        <form onSubmit={onSaveAutoroles}>
          <ChipPicker kind="role" items={d.roles} value={autoroles} onChange={setAutoroles} />
          <div className="v2-section-gap">
            <button type="submit" className="v2-btn-primary" disabled={savingAutoroles}>
              {savingAutoroles ? 'Saving…' : 'Save autoroles'}
            </button>
            {autorolesSaved ? <span className="v2-field-hint"> Saved.</span> : null}
          </div>
        </form>
      </div>
    </>
  );
}
