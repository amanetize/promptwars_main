import { STAGES_OF_CHANGE } from '../habitTypes.js';

export const coachSchema = {
  name: 'coaching_turn',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      therapeutic_response: { type: 'string' },
      detected_primary_emotion: {
        type: 'string',
        enum: ['calm', 'stressed', 'anxious', 'bored', 'happy', 'sad', 'angry', 'tired', 'hopeful', 'frustrated'],
      },
      // 'none' stands in for null (avoids nullable-type schema complexity);
      // the route maps 'none' back to null before storing/using it.
      stage_transition: { type: 'string', enum: [...STAGES_OF_CHANGE, 'none'] },
      crisis_flag: { type: 'boolean' },
    },
    required: ['therapeutic_response', 'detected_primary_emotion', 'stage_transition', 'crisis_flag'],
    additionalProperties: false,
  },
};
