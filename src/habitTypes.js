// Single source of truth for supported habit categories. Deliberately a
// small, fixed list (not a user-defined ontology) — every module looks up
// an entry by `key` and interpolates its fields rather than branching on
// habit type in code. The only special case is `custom`, whose
// `defaultDailyGoal` is null (no numeric ratio makes sense for an
// arbitrary user-named habit) and which requires a `label`.
export const HABIT_TYPES = [
  {
    key: 'screen_time',
    label: 'Screen Time',
    valueLabel: 'Minutes used',
    valueUnit: 'minutes',
    goalDirection: 'reduce_below_threshold',
    defaultDailyGoal: 120,
    triggerExamples: ['boredom', 'notification', 'in bed'],
    requiresLabel: false,
  },
  {
    key: 'smoking',
    label: 'Smoking',
    valueLabel: 'Cigarettes',
    valueUnit: 'count',
    goalDirection: 'abstinence',
    defaultDailyGoal: 0,
    triggerExamples: ['stress', 'after meal', 'coffee'],
    requiresLabel: false,
  },
  {
    key: 'snacking',
    label: 'Snacking / Junk Food',
    valueLabel: 'Servings',
    valueUnit: 'count',
    goalDirection: 'reduce_below_threshold',
    defaultDailyGoal: 2,
    triggerExamples: ['stress', 'boredom', 'late night'],
    requiresLabel: false,
  },
  {
    key: 'social_media',
    label: 'Social Media',
    valueLabel: 'Minutes used',
    valueUnit: 'minutes',
    goalDirection: 'reduce_below_threshold',
    defaultDailyGoal: 60,
    triggerExamples: ['notification', 'procrastination'],
    requiresLabel: false,
  },
  {
    key: 'gaming',
    label: 'Gaming',
    valueLabel: 'Minutes played',
    valueUnit: 'minutes',
    goalDirection: 'reduce_below_threshold',
    defaultDailyGoal: 90,
    triggerExamples: ['stress relief', 'avoidance'],
    requiresLabel: false,
  },
  {
    key: 'alcohol',
    label: 'Alcohol',
    valueLabel: 'Drinks',
    valueUnit: 'count',
    goalDirection: 'abstinence',
    defaultDailyGoal: 0,
    triggerExamples: ['social event', 'stress'],
    requiresLabel: false,
  },
  {
    key: 'custom',
    label: 'Custom / Other',
    valueLabel: 'Intensity or duration',
    valueUnit: 'custom',
    goalDirection: 'reduce_below_threshold',
    defaultDailyGoal: null,
    triggerExamples: [],
    requiresLabel: true,
  },
];

export const MOOD_OPTIONS = ['calm', 'stressed', 'anxious', 'bored', 'happy', 'sad', 'angry', 'tired'];

export const STAGES_OF_CHANGE = ['precontemplation', 'contemplation', 'preparation', 'action', 'maintenance'];

export function getHabitType(key) {
  return HABIT_TYPES.find((habitType) => habitType.key === key);
}
