import { useEffect, useRef, useState } from 'react';
import 'emoji-picker-element';

// Emoji chips plus a popover picker. `value` is a list of emoji keys: a unicode
// character, or the numeric id of a server custom emoji (the same convention
// the bot stores). `customEmojis` is [{ id, name, url }] from the API.
export default function EmojiPicker({ value, onChange, customEmojis = [], max = 10 }) {
  const selected = value || [];
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const picker = pickerRef.current;
    if (!picker) return undefined;
    picker.customEmoji = customEmojis.map((e) => ({ name: e.name, shortcodes: [e.name], url: e.url }));
    const onPick = (ev) => {
      const { unicode, name } = ev.detail;
      const key = unicode ?? customEmojis.find((e) => e.name === name)?.id;
      if (key && !selected.includes(key) && selected.length < max) onChange([...selected, key]);
    };
    const onOutside = (ev) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target)) setOpen(false);
    };
    picker.addEventListener('emoji-click', onPick);
    document.addEventListener('mousedown', onOutside);
    return () => {
      picker.removeEventListener('emoji-click', onPick);
      document.removeEventListener('mousedown', onOutside);
    };
  }, [open, selected, customEmojis, onChange, max]);

  const render = (key) => {
    const custom = /^\d+$/.test(key) ? customEmojis.find((e) => e.id === key) : null;
    if (custom) return <img className="v2-emoji-img" src={custom.url} alt={custom.name} title={custom.name} />;
    if (/^\d+$/.test(key)) return <span className="v2-field-hint">(deleted emoji)</span>;
    return <span className="v2-emoji-char">{key}</span>;
  };

  return (
    <div className="v2-emoji-picker" ref={wrapRef}>
      <div className="v2-chip-row">
        {selected.length === 0 ? <span className="v2-field-hint">None selected</span> : null}
        {selected.map((key) => (
          <span className="v2-chip" key={key}>
            {render(key)}
            <button
              type="button"
              className="v2-chip-x"
              aria-label="Remove emoji"
              onClick={() => onChange(selected.filter((k) => k !== key))}
            >
              &times;
            </button>
          </span>
        ))}
        {selected.length < max ? (
          <button type="button" className="v2-btn-ghost" onClick={() => setOpen((o) => !o)}>
            + Add emoji
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="v2-emoji-popover">
          <emoji-picker ref={pickerRef} class="dark" />
        </div>
      ) : null}
    </div>
  );
}
