export const insightSchema = {
  name: 'habit_insight',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      insightText: {
        type: 'string',
        description: "A short, specific, data-grounded insight about the user's behavioral pattern",
      },
      referencedStat: {
        type: 'string',
        description: 'The specific number/stat from the input data that the insight is based on',
      },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    },
    required: ['insightText', 'referencedStat', 'confidence'],
    additionalProperties: false,
  },
};
