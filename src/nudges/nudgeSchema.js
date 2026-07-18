export const nudgeSchema = {
  name: 'habit_nudge',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      nudgeText: {
        type: 'string',
        description: 'A short, supportive, non-shaming nudge shown to the user (max ~2 sentences)',
      },
      tone: {
        type: 'string',
        enum: ['encouraging', 'reflective', 'challenge', 'celebratory'],
      },
      suggestedMicroAction: {
        type: 'string',
        description: 'One small, concrete action the user could take right now, or an empty string if none applies',
      },
    },
    required: ['nudgeText', 'tone', 'suggestedMicroAction'],
    additionalProperties: false,
  },
};
