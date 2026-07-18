import { insertIntention, listIntentions, setIntentionActive } from './intentionsRepo.js';
import { getHabitType } from '../habitTypes.js';

const MAX_TEXT_LENGTH = 300;

function isValidText(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_TEXT_LENGTH;
}

export function createIntentionsHandlers({ db }) {
  return {
    postIntention(req, res) {
      const { habitType, ifTrigger, thenAction } = req.body || {};
      if (habitType !== undefined && habitType !== null && !getHabitType(habitType)) {
        return res.status(400).json({ error: `Unknown habitType "${habitType}".` });
      }
      if (!isValidText(ifTrigger) || !isValidText(thenAction)) {
        return res.status(400).json({ error: `ifTrigger and thenAction are required, up to ${MAX_TEXT_LENGTH} characters.` });
      }
      const intention = insertIntention(db, req.userId, {
        habitType: habitType ?? null,
        ifTrigger: ifTrigger.trim(),
        thenAction: thenAction.trim(),
      });
      return res.status(201).json({ intention });
    },

    getIntentions(req, res) {
      const { habitType, active } = req.query;
      const intentions = listIntentions(db, req.userId, {
        habitType: habitType || undefined,
        active: active === undefined ? undefined : active === 'true',
      });
      return res.status(200).json({ intentions });
    },

    patchIntention(req, res) {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'Invalid intention id.' });
      }
      const { active } = req.body || {};
      if (typeof active !== 'boolean') {
        return res.status(400).json({ error: 'active must be a boolean.' });
      }
      const intention = setIntentionActive(db, req.userId, id, active);
      if (!intention) {
        return res.status(404).json({ error: 'Intention not found.' });
      }
      return res.status(200).json({ intention });
    },
  };
}
