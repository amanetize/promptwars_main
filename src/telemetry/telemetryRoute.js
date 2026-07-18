import { validateTelemetryBatch, TelemetryValidationError } from './validate.js';
import { insertTelemetryBatch, insertBrowserTimeEvent, summarizeTelemetry } from './telemetryRepo.js';
import { deriveHabitEventsFromTelemetry } from './telemetryDerivation.js';

export function createTelemetryHandlers({ db }) {
  return {
    // Accepts a batch from any client — a real future companion app, or the
    // clearly-labeled demo simulator. Both write through this same real
    // endpoint, so downstream processing can't tell (and doesn't need to)
    // which one sent it.
    postSync(req, res) {
      let payload;
      try {
        payload = validateTelemetryBatch(req.body);
      } catch (err) {
        if (err instanceof TelemetryValidationError) {
          return res.status(400).json({ error: err.message });
        }
        throw err;
      }
      const insertedCount = insertTelemetryBatch(db, req.userId, payload);
      const derived = deriveHabitEventsFromTelemetry(db, req.userId);
      return res.status(201).json({ insertedCount, derivedHabitEvents: derived.length });
    },

    getSummary(req, res) {
      const { eventType, sinceDays } = req.query;
      const summary = summarizeTelemetry(db, req.userId, {
        eventType: eventType || undefined,
        sinceDays: sinceDays ? Number(sinceDays) : undefined,
      });
      return res.status(200).json({ summary });
    },

    // The one genuinely real, unsimulated telemetry source: actual time the
    // browser tab was visible, reported by the client's Page Visibility API.
    postBrowserTime(req, res) {
      const { minutes, recordedAt, recordedTz } = req.body || {};
      if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0 || minutes > 24 * 60) {
        return res.status(400).json({ error: 'minutes must be a number between 0 and 1440.' });
      }
      if (typeof recordedAt !== 'string' || Number.isNaN(new Date(recordedAt).getTime())) {
        return res.status(400).json({ error: 'recordedAt must be a valid timestamp.' });
      }
      if (typeof recordedTz !== 'string' || recordedTz.length === 0 || recordedTz.length > 64) {
        return res.status(400).json({ error: 'recordedTz is required.' });
      }
      const event = insertBrowserTimeEvent(db, req.userId, { minutes, recordedAt, recordedTz });
      return res.status(201).json({ event });
    },
  };
}
