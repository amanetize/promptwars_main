import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openDatabase } from './src/db/connection.js';
import { runMigrations } from './src/db/migrations.js';
import { sessionMiddleware } from './src/db/session.js';
import { HABIT_TYPES } from './src/habitTypes.js';

import { createEventsHandlers } from './src/tracking/eventsRoute.js';
import { createStateHandlers } from './src/tracking/stateRoute.js';
import { createSampleDataHandlers } from './src/tracking/sampleDataRoute.js';
import { createIntentionsHandlers } from './src/intentions/intentionsRoute.js';
import { createTelemetryHandlers } from './src/telemetry/telemetryRoute.js';
import { createNudgeHandler } from './src/nudges/nudgeRoute.js';
import { createCoachHandlers } from './src/coaching/coachRoute.js';
import { createSupportHandler } from './src/support/supportRoute.js';
import { createInsightHandler } from './src/insights/insightRoute.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Ordered fallback chain: a free model first, then a paid one, then
// OpenRouter's own free-model auto-router as a last-resort catch-all — so a
// single model/account hiccup doesn't take the whole feature down.
const OPENROUTER_MODELS = (process.env.OPENROUTER_MODELS || 'tencent/hy3:free,google/gemini-2.5-flash,openrouter/free')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

if (!OPENROUTER_API_KEY) {
  console.warn('Warning: OPENROUTER_API_KEY is not set. Copy .env.example to .env and add your key.');
}

const db = openDatabase();
runMigrations(db);

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

// Keyed by the anonymous session id, not raw IP — fair across evaluators
// behind shared NAT, and still bounds cost/abuse per user.
const llmRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
});

app.get('/api/habit-types', (req, res) => res.status(200).json({ habitTypes: HABIT_TYPES }));

const eventsHandlers = createEventsHandlers({ db });
app.post('/api/events', eventsHandlers.postEvent);
app.get('/api/events', eventsHandlers.getEvents);

const stateHandlers = createStateHandlers({ db });
app.get('/api/state', stateHandlers.getState);
app.patch('/api/state', stateHandlers.patchState);

const sampleDataHandlers = createSampleDataHandlers({ db });
app.post('/api/sample-data', sampleDataHandlers.postSeed);
app.delete('/api/sample-data', sampleDataHandlers.deleteSeed);

const intentionsHandlers = createIntentionsHandlers({ db });
app.post('/api/intentions', intentionsHandlers.postIntention);
app.get('/api/intentions', intentionsHandlers.getIntentions);
app.patch('/api/intentions/:id', intentionsHandlers.patchIntention);

const telemetryHandlers = createTelemetryHandlers({ db });
app.post('/api/telemetry/sync', telemetryHandlers.postSync);
app.get('/api/telemetry/summary', telemetryHandlers.getSummary);
app.post('/api/telemetry/browser-time', telemetryHandlers.postBrowserTime);

app.get(
  '/api/nudge',
  llmRateLimiter,
  createNudgeHandler({ db, apiKey: OPENROUTER_API_KEY, models: OPENROUTER_MODELS })
);

const coachHandlers = createCoachHandlers({ db, apiKey: OPENROUTER_API_KEY, models: OPENROUTER_MODELS });
app.post('/api/coach/message', llmRateLimiter, coachHandlers.postMessage);
app.get('/api/coach/history', coachHandlers.getHistory);

app.get('/api/support', createSupportHandler());

app.get(
  '/api/insight',
  llmRateLimiter,
  createInsightHandler({ db, apiKey: OPENROUTER_API_KEY, models: OPENROUTER_MODELS })
);

app.listen(PORT, () => {
  console.log(`Brohab running at http://localhost:${PORT}`);
});
