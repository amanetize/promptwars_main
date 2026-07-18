import { getHabitType, MOOD_OPTIONS } from '../habitTypes.js';

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const MAX_TEXT_LENGTH = 200;
const MAX_NOTES_LENGTH = 1000;
const MAX_VALUE = 100000;

function isIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  return !Number.isNaN(new Date(value).getTime());
}

// Validates and normalizes a raw POST /api/events body. Throws
// ValidationError with a user-facing message on any bad input.
export function validateEventPayload(body) {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object.');
  }

  const { habitType, occurredAt, triggerTag, mood, value, label, notes, source } = body;

  if (typeof habitType !== 'string') {
    throw new ValidationError('habitType is required.');
  }
  const habitTypeConfig = getHabitType(habitType);
  if (!habitTypeConfig) {
    throw new ValidationError(`Unknown habitType "${habitType}".`);
  }

  if (!Number.isInteger(value) || value < 0 || value > MAX_VALUE) {
    throw new ValidationError(`value must be a non-negative integer up to ${MAX_VALUE}.`);
  }

  if (habitTypeConfig.requiresLabel) {
    if (typeof label !== 'string' || label.trim().length === 0) {
      throw new ValidationError(`label is required for habitType "${habitType}".`);
    }
  }
  if (label !== undefined && label !== null && (typeof label !== 'string' || label.length > MAX_TEXT_LENGTH)) {
    throw new ValidationError(`label must be a string up to ${MAX_TEXT_LENGTH} characters.`);
  }

  if (triggerTag !== undefined && triggerTag !== null && (typeof triggerTag !== 'string' || triggerTag.length > MAX_TEXT_LENGTH)) {
    throw new ValidationError(`triggerTag must be a string up to ${MAX_TEXT_LENGTH} characters.`);
  }

  if (mood !== undefined && mood !== null && !MOOD_OPTIONS.includes(mood)) {
    throw new ValidationError(`mood must be one of: ${MOOD_OPTIONS.join(', ')}.`);
  }

  if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > MAX_NOTES_LENGTH)) {
    throw new ValidationError(`notes must be a string up to ${MAX_NOTES_LENGTH} characters.`);
  }

  const normalizedOccurredAt = occurredAt !== undefined ? occurredAt : new Date().toISOString();
  if (!isIsoTimestamp(normalizedOccurredAt)) {
    throw new ValidationError('occurredAt must be a valid ISO-8601 timestamp.');
  }

  const normalizedSource = source !== undefined ? source : 'manual';
  if (!['manual', 'device_sync'].includes(normalizedSource)) {
    throw new ValidationError('source must be "manual" or "device_sync".');
  }

  return {
    habitType,
    occurredAt: normalizedOccurredAt,
    triggerTag: triggerTag?.trim?.() ?? null,
    mood: mood ?? null,
    value,
    label: label?.trim?.() ?? null,
    notes: notes?.trim?.() ?? null,
    source: normalizedSource,
  };
}
