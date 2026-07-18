import { seedSampleData, clearUserData } from './sampleData.js';

// DI'd on `db` so tests can pass a temp/in-memory SQLite instance. Not an LLM
// route, so it intentionally skips the LLM rate limiter.
export function createSampleDataHandlers({ db }) {
  return {
    postSeed(req, res) {
      const seeded = seedSampleData(db, req.userId);
      return res.status(201).json({ ok: true, seeded });
    },
    deleteSeed(req, res) {
      clearUserData(db, req.userId);
      return res.status(200).json({ ok: true, message: 'All user data cleared.' });
    },
  };
}
