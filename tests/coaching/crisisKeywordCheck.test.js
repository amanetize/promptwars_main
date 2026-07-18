import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectsCrisisLanguage } from '../../src/coaching/crisisKeywordCheck.js';

test('flags common crisis phrases', () => {
  assert.equal(detectsCrisisLanguage('I want to kill myself'), true);
  assert.equal(detectsCrisisLanguage('I took an overdose last night'), true);
  assert.equal(detectsCrisisLanguage('I just cant go on anymore'), true);
});

test('does not flag ordinary habit-coaching messages', () => {
  assert.equal(detectsCrisisLanguage('I had a rough day and scrolled for 3 hours'), false);
  assert.equal(detectsCrisisLanguage('I want to quit smoking by next month'), false);
});

test('handles non-string input safely', () => {
  assert.equal(detectsCrisisLanguage(undefined), false);
  assert.equal(detectsCrisisLanguage(null), false);
});
