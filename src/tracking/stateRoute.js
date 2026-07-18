import { computeState, getCrossHabitSummary, upsertUserHabitState } from './stateRepo.js';
import { getHabitType, STAGES_OF_CHANGE } from '../habitTypes.js';

export function createStateHandlers({ db }) {
  return {
    getState(req, res) {
      const { habitType } = req.query;
      if (!habitType) {
        return res.status(200).json({ habitTypes: getCrossHabitSummary(db, req.userId) });
      }
      if (!getHabitType(habitType)) {
        return res.status(400).json({ error: `Unknown habitType "${habitType}".` });
      }
      const state = computeState(db, req.userId, habitType);
      return res.status(200).json({ state });
    },

    patchState(req, res) {
      const { habitType, stageOfChange, dailyGoalValue } = req.body || {};
      if (!habitType || !getHabitType(habitType)) {
        return res.status(400).json({ error: 'A valid habitType is required.' });
      }
      if (stageOfChange !== undefined && !STAGES_OF_CHANGE.includes(stageOfChange)) {
        return res.status(400).json({ error: 'Invalid stageOfChange.' });
      }
      if (dailyGoalValue !== undefined && (!Number.isInteger(dailyGoalValue) || dailyGoalValue < 0)) {
        return res.status(400).json({ error: 'dailyGoalValue must be a non-negative integer.' });
      }
      const state = upsertUserHabitState(db, req.userId, habitType, { stageOfChange, dailyGoalValue });
      return res.status(200).json({ state });
    },
  };
}
