// Bot Personalizer — bot-wide presence, stored and re-applied on every
// startup. The identity card is read-only: Fluxer refuses profile edits
// (PATCH /users/@me) from bot tokens, so name / avatar / banner are changed in
// the application's settings in Fluxer.
import { Router } from 'express';
import { runtime } from '../../runtime.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  getPresenceConfig,
  setPresenceConfig,
  PRESENCE_TYPES,
  PRESENCE_STATUSES,
} from '../../db/appSettings.js';
import { applyPresence } from '../../bot/lib/presence.js';

const router = Router();

function back(res, text, ok) {
  res.redirect(`/settings?m=${encodeURIComponent(text)}&ok=${ok ? 1 : 0}`);
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const u = runtime.client?.user ?? null;
    res.render('settings', {
      bot: u
        ? {
            tag: u.tag,
            username: u.username,
            id: u.id,
            avatar: u.displayAvatarURL({ size: 128 }),
          }
        : null,
      presence: await getPresenceConfig(),
      presenceTypes: PRESENCE_TYPES,
      presenceStatuses: PRESENCE_STATUSES,
      m: typeof req.query.m === 'string' ? req.query.m : null,
      ok: req.query.ok === '1',
    });
  })
);

router.post(
  '/presence',
  asyncHandler(async (req, res) => {
    await setPresenceConfig({ status: req.body.status, type: req.body.type, text: req.body.text });
    if (runtime.client) applyPresence(runtime.client);
    back(res, 'Presence updated.', true);
  })
);

export default router;
