// htmx response helpers.

/**
 * JSON for an `HX-Trigger` header. HTTP header values must be ASCII, so any
 * other character (—, æøå, emoji in a channel name, …) is written as a JSON
 * \uXXXX escape — htmx's JSON.parse turns it back into the same text.
 * @param {object} payload  e.g. { toast: { msg, kind } }
 */
export function hxTrigger(payload) {
  return JSON.stringify(payload).replace(
    /[^\x20-\x7e]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}
