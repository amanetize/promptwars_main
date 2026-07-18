import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEventPayload, ValidationError } from '../../src/tracking/validate.js';

test('applies defaults for optional fields', () => {
  const result = validateEventPayload({ habitType: 'screen_time', value: 45 });
  assert.equal(result.source, 'manual');
  assert.equal(result.triggerTag, null);
  assert.ok(result.occurredAt);
});

test('rejects unknown habitType', () => {
  assert.throws(() => validateEventPayload({ habitType: 'not_real', value: 1 }), ValidationError);
});

test('rejects non-integer value', () => {
  assert.throws(() => validateEventPayload({ habitType: 'screen_time', value: 'lots' }), ValidationError);
});

test('requires label for custom habit type', () => {
  assert.throws(() => validateEventPayload({ habitType: 'custom', value: 1 }), ValidationError);
  const result = validateEventPayload({ habitType: 'custom', value: 1, label: 'Doomscrolling news' });
  assert.equal(result.label, 'Doomscrolling news');
});

test('rejects invalid mood', () => {
  assert.throws(
    () => validateEventPayload({ habitType: 'screen_time', value: 1, mood: 'ecstatic-beyond-belief' }),
    ValidationError
  );
});

test('rejects overlong notes', () => {
  assert.throws(
    () => validateEventPayload({ habitType: 'screen_time', value: 1, notes: 'x'.repeat(2000) }),
    ValidationError
  );
});

test('rejects non-object body', () => {
  assert.throws(() => validateEventPayload(null), ValidationError);
});
