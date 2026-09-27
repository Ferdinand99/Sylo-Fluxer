// Timestamps in bot messages. 'native' writes the <t:unix:style> markup, which
// clients render in the reader's timezone; 'text' (FLUXER_TIMESTAMPS=text)
// writes a plain UTC string for clients that don't render the markup.
import { config } from '../config.js';

const pad = (n) => String(n).padStart(2, '0');

/** @param {number} deltaSec  target minus now, in seconds */
function relative(deltaSec) {
  const abs = Math.abs(deltaSec);
  const units = [
    ['y', 365 * 86400],
    ['mo', 30 * 86400],
    ['d', 86400],
    ['h', 3600],
    ['m', 60],
  ];
  let text = `${Math.max(1, Math.round(abs))}s`;
  for (const [unit, size] of units) {
    if (abs >= size) {
      text = `${Math.round(abs / size)}${unit}`;
      break;
    }
  }
  return deltaSec >= 0 ? `in ${text}` : `${text} ago`;
}

/**
 * Plain-text rendering of a timestamp for the given style.
 * @param {number} unix  seconds
 * @param {string} style  t | T | d | D | f | F | R
 * @param {number} [now]  ms, for tests
 */
export function formatTimestampText(unix, style = 'f', now = Date.now()) {
  if (style === 'R') return relative(unix - now / 1000);
  const d = new Date(unix * 1000);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const hm = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  switch (style) {
    case 't':
      return `${hm} UTC`;
    case 'T':
      return `${hm}:${pad(d.getUTCSeconds())} UTC`;
    case 'd':
    case 'D':
      return date;
    default:
      return `${date} ${hm} UTC`;
  }
}

/**
 * discord.js-compatible `time()`: accepts a Date, epoch ms (as a Date) or unix
 * seconds (as a number) and a style letter.
 * @param {Date | number} value
 * @param {string} [style]
 */
export function time(value, style = 'f') {
  const unix = value instanceof Date ? Math.floor(value.getTime() / 1000) : Math.floor(Number(value));
  if (config.fluxerTimestamps === 'text') return formatTimestampText(unix, style);
  return `<t:${unix}:${style}>`;
}

/** Same as {@link time} but takes epoch milliseconds. */
export const ts = (ms, style = 'f') => time(Math.floor(ms / 1000), style);
