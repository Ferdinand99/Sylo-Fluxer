// Fluxer ids are Twitter-style snowflakes (currently 19 digits), same shape as
// the ids Sylo has always validated. Keep every id check going through here.

export const SNOWFLAKE_RE = /^\d{17,20}$/;

/** @param {unknown} value */
export const isSnowflake = (value) => typeof value === 'string' && SNOWFLAKE_RE.test(value);
