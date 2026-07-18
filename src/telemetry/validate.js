export class TelemetryValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TelemetryValidationError';
  }
}

// Server-side allow-list of accepted telemetry event types with sane value
// ranges. Rejecting unknown types outright (rather than silently dropping
// them) keeps the failure visible and the code path simple/testable.
export const EVENT_TYPE_RULES = {
  app_usage_summary: { min: 0, max: 24 * 60 },
  device_charging_session: { min: 0, max: 24 * 60 },
  step_count: { min: 0, max: 100000 },
};

const MAX_BATCH_SIZE = 500;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_PAST_MS = 30 * 24 * 60 * 60 * 1000;
const TZ_PATTERN = /^UTC$|^[A-Za-z]+(?:\/[A-Za-z_]+)+$/;
const OFFSET_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

function assertTimestamp(recordedAt, index) {
  if (typeof recordedAt !== 'string' || !OFFSET_PATTERN.test(recordedAt)) {
    throw new TelemetryValidationError(
      `events[${index}].recordedAt must be an ISO-8601 timestamp with an explicit UTC offset (e.g. ending in "Z" or "+05:30").`
    );
  }
  const timestamp = new Date(recordedAt).getTime();
  if (Number.isNaN(timestamp)) {
    throw new TelemetryValidationError(`events[${index}].recordedAt is not a valid timestamp.`);
  }
  const now = Date.now();
  if (timestamp - now > MAX_FUTURE_SKEW_MS) {
    throw new TelemetryValidationError(`events[${index}].recordedAt is too far in the future.`);
  }
  if (now - timestamp > MAX_PAST_MS) {
    throw new TelemetryValidationError(`events[${index}].recordedAt is too far in the past (max 30 days).`);
  }
}

// Validates a POST /api/telemetry/sync body. Throws TelemetryValidationError
// with a user-facing message on any bad input.
export function validateTelemetryBatch(body) {
  if (!body || typeof body !== 'object') {
    throw new TelemetryValidationError('Request body must be a JSON object.');
  }
  const { deviceId, syncBatchId, events } = body;

  if (typeof deviceId !== 'string' || deviceId.length === 0 || deviceId.length > 100) {
    throw new TelemetryValidationError('deviceId is required (string, up to 100 characters).');
  }
  if (syncBatchId !== undefined && (typeof syncBatchId !== 'string' || syncBatchId.length > 100)) {
    throw new TelemetryValidationError('syncBatchId must be a string up to 100 characters.');
  }
  if (!Array.isArray(events) || events.length === 0) {
    throw new TelemetryValidationError('events must be a non-empty array.');
  }
  if (events.length > MAX_BATCH_SIZE) {
    throw new TelemetryValidationError(`events batch too large (max ${MAX_BATCH_SIZE}).`);
  }

  const validatedEvents = events.map((event, index) => {
    if (!event || typeof event !== 'object') {
      throw new TelemetryValidationError(`events[${index}] must be an object.`);
    }
    const { eventType, value, unit, recordedAt, recordedTz, metadata } = event;

    const rule = EVENT_TYPE_RULES[eventType];
    if (!rule) {
      throw new TelemetryValidationError(`events[${index}].eventType "${eventType}" is not allow-listed.`);
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < rule.min || value > rule.max) {
      throw new TelemetryValidationError(
        `events[${index}].value out of range for "${eventType}" (expected ${rule.min}-${rule.max}).`
      );
    }
    if (typeof recordedTz !== 'string' || !TZ_PATTERN.test(recordedTz)) {
      throw new TelemetryValidationError(
        `events[${index}].recordedTz must be an IANA timezone name (e.g. "America/Los_Angeles") or "UTC".`
      );
    }
    assertTimestamp(recordedAt, index);
    if (metadata !== undefined && metadata !== null && typeof metadata !== 'object') {
      throw new TelemetryValidationError(`events[${index}].metadata must be an object if provided.`);
    }

    return {
      eventType,
      valueNumeric: value,
      unit: unit ?? null,
      recordedAt,
      recordedTz,
      metadata: metadata ?? null,
    };
  });

  return { deviceId, syncBatchId: syncBatchId ?? null, events: validatedEvents };
}
