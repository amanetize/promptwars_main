import { validateEventPayload, ValidationError } from './validate.js';
import { insertEvent, listEvents } from './eventsRepo.js';

// DI'd on `db` so tests can pass a temp/in-memory SQLite instance.
export function createEventsHandlers({ db }) {
  return {
    postEvent(req, res) {
      let payload;
      try {
        payload = validateEventPayload(req.body);
      } catch (err) {
        if (err instanceof ValidationError) {
          return res.status(400).json({ error: err.message });
        }
        throw err;
      }
      const event = insertEvent(db, req.userId, payload);
      return res.status(201).json({ event });
    },

    getEvents(req, res) {
      const { habitType, limit, before } = req.query;
      const events = listEvents(db, req.userId, {
        habitType: habitType || undefined,
        limit: limit ? Number(limit) : undefined,
        before: before || undefined,
      });
      return res.status(200).json({ events });
    },
  };
}
