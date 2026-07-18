import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSupportHandler } from '../../src/support/supportRoute.js';

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('always returns the static resource panel, independent of any state', () => {
  const handler = createSupportHandler();
  const res = mockRes();
  handler({}, res);
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.resources));
  assert.ok(res.body.resources.length > 0);
});
