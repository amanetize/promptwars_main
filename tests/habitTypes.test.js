import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HABIT_TYPES, getHabitType } from '../src/habitTypes.js';

test('every habit type has a unique key and required fields', () => {
  const keys = HABIT_TYPES.map((h) => h.key);
  assert.equal(new Set(keys).size, keys.length, 'habit type keys must be unique');

  for (const habitType of HABIT_TYPES) {
    assert.ok(habitType.label);
    assert.ok(habitType.valueLabel);
    assert.ok(habitType.valueUnit);
    assert.ok(['reduce_below_threshold', 'abstinence'].includes(habitType.goalDirection));
    assert.ok(Array.isArray(habitType.triggerExamples));
  }
});

test('custom habit type is the designated fallback', () => {
  const custom = getHabitType('custom');
  assert.ok(custom);
  assert.equal(custom.defaultDailyGoal, null);
  assert.equal(custom.requiresLabel, true);
});

test('getHabitType returns undefined for an unknown key', () => {
  assert.equal(getHabitType('not_a_real_type'), undefined);
});
