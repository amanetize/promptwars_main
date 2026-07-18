import { MOOD_OPTIONS } from '../habitTypes.js';
import { insertEvent } from './eventsRepo.js';
import { insertIntention } from '../intentions/intentionsRepo.js';
import { upsertUserHabitState } from './stateRepo.js';
import { insertTelemetryBatch } from '../telemetry/telemetryRepo.js';
import { insertMessage } from '../coaching/messagesRepo.js';

// Demo seeding so a first-time visitor can immediately explore every feature
// (progress, mood chart, nudges, insights, coaching, intentions) without
// hand-logging a month of entries. Everything is scoped to the caller's
// anonymous userId, and we wipe that user's existing rows first so the button
// is idempotent and predictable on repeat clicks.

const TOTAL_DAYS = 30;
const TELEMETRY_DAYS = 14;

function isoDaysAgo(days, hour = 20, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function moodForSuccess(success) {
  if (success === null) return pickRandom(MOOD_OPTIONS);
  return success ? pickRandom(['calm', 'happy', 'tired']) : pickRandom(['stressed', 'bored', 'anxious']);
}

// One profile per habit type the UI can focus on. `goal` null = no numeric
// target (custom habit); `abstinence` means success is value === 0.
const HABIT_PROFILES = [
  {
    habitType: 'screen_time',
    min: 90,
    max: 220,
    goal: 120,
    trend: 'down',
    triggers: ['boredom', 'notification', 'in bed'],
    label: null,
    notes: [
      'Doomscrolled again, oops.',
      'Capped it early tonight, felt good.',
      'Work + a little YouTube, not bad.',
    ],
  },
  {
    habitType: 'smoking',
    min: 0,
    max: 9,
    goal: 0,
    abstinence: true,
    trend: 'down',
    triggers: ['stress', 'after meal', 'coffee'],
    label: null,
    notes: ['Rough day, smoked more than I wanted.', 'Walked instead of lighting up once.'],
  },
  {
    habitType: 'snacking',
    min: 0,
    max: 5,
    goal: 2,
    trend: 'down',
    triggers: ['stress', 'boredom', 'late night'],
    label: null,
    notes: ['Late-night fridge raid.', 'Stayed under goal today.'],
  },
  {
    habitType: 'social_media',
    min: 20,
    max: 180,
    goal: 60,
    trend: 'down',
    triggers: ['notification', 'procrastination'],
    label: null,
    notes: ['Fell into a reel hole for an hour.', 'Just a quick check-in.'],
  },
  {
    habitType: 'gaming',
    min: 0,
    max: 200,
    goal: 90,
    trend: 'steady',
    triggers: ['stress relief', 'avoidance'],
    skipChance: 0.45,
    label: null,
    notes: ['Lost track of time with friends.', 'Skipped it to go outside.'],
  },
  {
    habitType: 'alcohol',
    min: 0,
    max: 5,
    goal: 0,
    abstinence: true,
    trend: 'steady',
    triggers: ['social event', 'stress'],
    skipChance: 0.6,
    label: null,
    notes: ['One too many at the party.', 'Sober night, felt clear-headed.'],
  },
  {
    habitType: 'custom',
    min: 1,
    max: 10,
    goal: null,
    trend: 'down',
    triggers: ['stress', 'boredom'],
    label: 'Nail biting',
    skipChance: 0.1,
    notes: ['Caught myself during a call.', 'Kept my hands busy all day.'],
  },
];

const INTENTIONS = [
  {
    habitType: 'screen_time',
    ifTrigger: 'I get a notification after dinner',
    thenAction: 'I leave my phone in the kitchen for the rest of the evening',
    active: 1,
  },
  {
    habitType: 'screen_time',
    ifTrigger: 'I feel bored in bed',
    thenAction: 'I read a physical book instead of scrolling',
    active: 1,
  },
  {
    habitType: 'smoking',
    ifTrigger: 'I finish a coffee',
    thenAction: 'I go for a 5-minute walk instead of lighting up',
    active: 1,
  },
  {
    habitType: 'smoking',
    ifTrigger: 'I feel a stress spike at work',
    thenAction: 'I do 10 deep breaths before reaching for a cigarette',
    active: 0,
  },
  {
    habitType: 'snacking',
    ifTrigger: 'I crave something sweet late at night',
    thenAction: 'I drink a glass of water and brush my teeth',
    active: 1,
  },
];

const HABIT_STAGES = [
  { habitType: 'screen_time', stageOfChange: 'action' },
  { habitType: 'smoking', stageOfChange: 'action' },
  { habitType: 'snacking', stageOfChange: 'preparation' },
  { habitType: 'social_media', stageOfChange: 'action' },
  { habitType: 'gaming', stageOfChange: 'contemplation' },
  { habitType: 'alcohol', stageOfChange: 'preparation' },
  { habitType: 'custom', stageOfChange: 'action' },
];

const COACHING_MESSAGES = [
  {
    role: 'user',
    content: 'I keep reaching for my phone right before bed and it wrecks my sleep.',
    habitTypeContext: 'screen_time',
    detectedPrimaryEmotion: 'stressed',
  },
  {
    role: 'assistant',
    content:
      "That pre-bed scroll is a tough one. What usually kicks it off — a notification, or just the habit of checking?",
    habitTypeContext: 'screen_time',
  },
  {
    role: 'user',
    content: 'Usually a notification pings and then I fall in by accident.',
    habitTypeContext: 'screen_time',
    detectedPrimaryEmotion: 'bored',
  },
  {
    role: 'assistant',
    content:
      "Nice insight. Let's make a plan: when a notification pings after 9pm, you put the phone in the kitchen. Want me to save that as an if-then plan?",
    habitTypeContext: 'screen_time',
    stageTransition: 'preparation->action',
  },
];

const TABLES_BY_USER = [
  'habit_events',
  'telemetry_events',
  'user_habit_state',
  'implementation_intentions',
  'coaching_messages',
  'coaching_summaries',
];

export function clearUserData(db, userId) {
  const tx = db.transaction(() => {
    for (const table of TABLES_BY_USER) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
    }
  });
  tx();
}

function seedEvents(db, userId) {
  let count = 0;
  const tx = db.transaction(() => {
    for (const profile of HABIT_PROFILES) {
      for (let day = TOTAL_DAYS - 1; day >= 0; day -= 1) {
        if (profile.skipChance && Math.random() < profile.skipChance) continue;

        const progress = (TOTAL_DAYS - 1 - day) / (TOTAL_DAYS - 1);
        const span = profile.max - profile.min;
        let value = profile.min + Math.round(Math.random() * span);
        if (profile.trend === 'down') value -= Math.round(span * 0.4 * progress);
        if (profile.trend === 'up') value += Math.round(span * 0.3 * progress);
        value = Math.max(profile.min, Math.min(profile.max, value));

        let success = null;
        if (profile.goal !== null) {
          success = profile.abstinence ? value === 0 : value <= profile.goal;
        }

        insertEvent(db, userId, {
          habitType: profile.habitType,
          occurredAt: isoDaysAgo(day, 19 + (day % 4), (day * 7) % 60),
          triggerTag: pickRandom(profile.triggers),
          mood: moodForSuccess(success),
          value,
          label: profile.label ?? null,
          notes: pickRandom(profile.notes),
          source: 'manual',
        });
        count += 1;
      }
    }
  });
  tx();
  return count;
}

function seedIntentions(db, userId) {
  let count = 0;
  const tx = db.transaction(() => {
    for (const intention of INTENTIONS) {
      insertIntention(db, userId, {
        habitType: intention.habitType,
        ifTrigger: intention.ifTrigger,
        thenAction: intention.thenAction,
      });
      if (!intention.active) {
        // Deactivate after insert so it shows in the "done" state.
        const inserted = db
          .prepare('SELECT id FROM implementation_intentions WHERE user_id = ? ORDER BY id DESC LIMIT 1')
          .get(userId);
        if (inserted) {
          db.prepare('UPDATE implementation_intentions SET active = 0 WHERE id = ?').run(inserted.id);
        }
      }
      count += 1;
    }
  });
  tx();
  return count;
}

function seedHabitStates(db, userId) {
  let count = 0;
  const tx = db.transaction(() => {
    for (const { habitType, stageOfChange } of HABIT_STAGES) {
      upsertUserHabitState(db, userId, habitType, { stageOfChange });
      count += 1;
    }
  });
  tx();
  return count;
}

function seedTelemetry(db, userId) {
  let count = 0;
  const deviceId = 'demo-phone';
  const tx = db.transaction(() => {
    for (let day = TELEMETRY_DAYS - 1; day >= 0; day -= 1) {
      const base = isoDaysAgo(day, 22, 0);
      const events = [
        {
          eventType: 'app_usage_summary',
          value: 60 + Math.round(Math.random() * 120),
          unit: 'minutes',
          recordedAt: base,
          recordedTz: 'America/New_York',
        },
        {
          eventType: 'step_count',
          value: 2000 + Math.round(Math.random() * 6000),
          unit: 'steps',
          recordedAt: isoDaysAgo(day, 23, 0),
          recordedTz: 'America/New_York',
        },
        {
          eventType: 'device_charging_session',
          value: 30 + Math.round(Math.random() * 90),
          unit: 'minutes',
          recordedAt: isoDaysAgo(day, 1, 0),
          recordedTz: 'America/New_York',
        },
      ];
      count += insertTelemetryBatch(db, userId, { deviceId, syncBatchId: `demo-seed-${day}`, events });
    }
  });
  tx();
  return count;
}

function seedCoaching(db, userId) {
  let count = 0;
  const tx = db.transaction(() => {
    for (const message of COACHING_MESSAGES) {
      insertMessage(db, userId, {
        role: message.role,
        content: message.content,
        habitTypeContext: message.habitTypeContext,
        detectedPrimaryEmotion: message.detectedPrimaryEmotion,
        stageTransition: message.stageTransition,
      });
      count += 1;
    }
  });
  tx();
  return count;
}

export function seedSampleData(db, userId) {
  clearUserData(db, userId);
  const seeded = {
    events: seedEvents(db, userId),
    intentions: seedIntentions(db, userId),
    habitStates: seedHabitStates(db, userId),
    telemetryEvents: seedTelemetry(db, userId),
    messages: seedCoaching(db, userId),
  };
  return seeded;
}
