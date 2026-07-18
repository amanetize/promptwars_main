import { getHabitType } from '../habitTypes.js';
import { buildCoachMessages } from './contextBuilder.js';
import { coachSchema } from './coachSchema.js';
import { insertMessage, listAllMessages } from './messagesRepo.js';
import { upsertUserHabitState } from '../tracking/stateRepo.js';
import { detectsCrisisLanguage } from './crisisKeywordCheck.js';
import { CRISIS_RESOURCES } from '../support/crisisResources.js';
import { maybeRefreshSummary } from './summarizer.js';
import { requestWithModelFallback, OpenRouterError } from '../llm/openrouter.js';

const MAX_MESSAGE_LENGTH = 2000;

export function createCoachHandlers({ db, apiKey, models, requestCompletion = requestWithModelFallback }) {
  return {
    async postMessage(req, res) {
      const { message, habitTypeContext } = req.body || {};
      if (typeof message !== 'string' || message.trim().length === 0 || message.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: `message is required, up to ${MAX_MESSAGE_LENGTH} characters.` });
      }
      if (habitTypeContext !== undefined && habitTypeContext !== null && !getHabitType(habitTypeContext)) {
        return res.status(400).json({ error: `Unknown habitTypeContext "${habitTypeContext}".` });
      }
      if (!apiKey) {
        return res.status(503).json({ error: 'Server is missing OPENROUTER_API_KEY configuration.' });
      }

      insertMessage(db, req.userId, { role: 'user', content: message, habitTypeContext });

      // Deterministic co-trigger, checked independently of what the model decides.
      const keywordCrisis = detectsCrisisLanguage(message);
      const messages = buildCoachMessages(db, req.userId, message, habitTypeContext);

      let result;
      try {
        result = await requestCompletion({ apiKey, models, messages, jsonSchema: coachSchema });
      } catch (err) {
        if (err instanceof OpenRouterError) {
          const status = err.status >= 400 && err.status < 600 ? err.status : 502;
          return res.status(status).json({ error: err.message });
        }
        console.error('Unexpected error in coach postMessage:', err);
        return res.status(500).json({ error: 'Something went wrong. Please try again.' });
      }

      const isCrisis = keywordCrisis || result.crisis_flag === true;
      const stageTransition = result.stage_transition && result.stage_transition !== 'none' ? result.stage_transition : null;

      // The real model output is always persisted for audit, even when
      // suppressed from the client below.
      insertMessage(db, req.userId, {
        role: 'assistant',
        content: result.therapeutic_response,
        habitTypeContext,
        detectedPrimaryEmotion: result.detected_primary_emotion,
        stageTransition,
        crisisFlag: isCrisis,
      });

      if (stageTransition && habitTypeContext) {
        upsertUserHabitState(db, req.userId, habitTypeContext, { stageOfChange: stageTransition });
      }

      // Fire-and-forget: never blocks the user's response on a second LLM call.
      maybeRefreshSummary(db, req.userId, { apiKey, models, requestCompletion }).catch((err) => {
        console.error('Summary refresh failed:', err);
      });

      if (isCrisis) {
        return res.status(200).json({ crisis: true, resources: CRISIS_RESOURCES });
      }

      return res.status(200).json({
        crisis: false,
        message: result.therapeutic_response,
        detectedEmotion: result.detected_primary_emotion,
        stageTransition,
      });
    },

    getHistory(req, res) {
      const messages = listAllMessages(db, req.userId, 200).map((m) => ({
        role: m.role,
        // Never resurface a suppressed crisis-turn's raw text to the client.
        content: m.crisis_flag ? null : m.content,
        crisis: Boolean(m.crisis_flag),
        createdAt: m.created_at,
      }));
      return res.status(200).json({ messages });
    },
  };
}
