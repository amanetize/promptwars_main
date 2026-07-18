# Brohab — a GenAI companion for breaking bad habits

> **Breaking Bad Habits & Addiction.** A GenAI-powered web application that helps users reduce or overcome harmful habits such as excessive screen time, snacking, or procrastination. It uses Generative AI as a core component to deliver **intelligent nudges**, **personalised tracking**, **adaptive coaching**, and **support mechanisms** that encourage **sustained behaviour change.**

**Brohab is not just a chatbot.** It is a cohesive, data-grounded system that connects your real-world habit logs to an interactive ecosystem. Every event logged shapes your profile, informs the coach, determines the timing of real-time nudges, and drives personalized behavioural insights. If you ever mention a crisis word, the coach immediately shows a dedicated safety/support panel. No artificial delays, no black-box retries—just direct, structured support.

**[Live Demo](https://promptwars-main-5fpb.onrender.com)**

---

## The 30-second demo

1. **Select or Create a Habit** → Choose a focus habit (e.g., screen time, snacking) or enter a custom one.
2. **Log a Habit Entry** → Input the amount consumed/spent, select your current mood, write down the trigger (e.g., stress, boredom), and add notes.
3. **Get a Nudge** → Click **"Get a nudge"**. The AI reasons over your recent history and mood trends to deliver a timely, tailored push.
4. **Chat with the Habit Bro** → Use **"Coach chat"** to discuss your struggles. The coach adapts its responses based on the habit, trigger history, and progress.
5. **Get Pattern Insights** → Click **"Show me my patterns"** to get a data-grounded assessment of your habits, identifying mood-trigger correlations.
6. **Set If-Then Plans** → Create implementation intentions (e.g., *"If I feel the urge to check my phone in bed, then I will put my phone across the room"*).
7. **Simulate Telemetry Sync** → Open the **Device Sync Simulator** link in the footer to simulate background telemetry ingestion.

---

## How this maps to the problem statement (mechanism by mechanism)

The problem statement names four mechanisms. Each is a real, working feature in Brohab:

| Required mechanism | Where it lives in Brohab |
|---|---|
| **Personalised tracking** | Log entries record amount, mood, trigger, and notes. The front-end renders a **recent mood trend chart** and calculates streaks. Telemetry tables keep track of background usage. |
| **Intelligent nudges** | `/api/nudge` — Fired on demand based on recent logs, mood levels, and triggers. If mood is highly negative or frequency is peaking, the system raises risk levels and adapts the message. |
| **Adaptive coaching** | `/api/coach/message` — The coach reads your selected habit, recent progress, triggers, and previous chat logs to deliver personalized guidance grounded in CBT. |
| **Support mechanisms** | Crisis detection triggers a prominent safety panel instantly. If-then (implementation intention) planning maps triggers directly to concrete action steps. |
| **Sustained behaviour change** | A loop of logging, real-time nudges, chat check-ins, and actionable plans that helps users build self-awareness over time. |

---

## Why the AI is load-bearing (not a wrapper)

The coaching, insights, and nudging are deep reasoning tasks. Brohab does not simply inject your name into a template:
- **Tailored Nudging:** The AI examines your recent mood state and triggers to generate contextually relevant reframings rather than generic warnings.
- **Pattern Synthesis:** The insight generator runs statistical summaries over your database tables and prompts the model to find underlying trends, such as correlations between specific negative moods and trigger times.
- **Fail-safe Fallbacks:** Every LLM route is wrapped in robust logic. If the API key is missing or the external service fails, the app gracefully degrades to a **data-grounded heuristic fallback** that calculates your statistics and offers standard CBT reframings—ensuring the application remains fully functional at all times.

---

## Architecture (decoupled layers)

```
src/
  coaching/       prompt builders, chat message repositories, and system instructions
  db/             SQLite connection, table migrations, and session management
  insights/       log calculators and AI generators for pattern discovery
  intentions/     management of implementation intentions (if-then plans)
  llm/            OpenRouter integration with multi-model failover chains
  nudges/         nudge prompt builders and handlers
  support/        crisis keyword checklists and helpline resources
  telemetry/      background browser/device usage tracking endpoints
  tracking/       habit log events and state management

public/           the static frontend files
  app.js          the conductor: binds forms, logs, statistics, and handles updates
  charts.js       renders the SVG/HTML mood-trends chart dynamically
  coach.js        manages the chat history render and scroll states
  index.html      accessible, semantic HTML skeleton
  styles.css      curated dark/glassmorphic custom layout styles

server.js         Express server routing, cookie sessions, and global rate limiters
tests/            comprehensive test suites for all router endpoints and DB structures
```

---

## How this satisfies the six scored parameters

| Parameter | How |
|---|---|
| **Problem alignment** | Every required mechanism maps directly to active modules (tracking, nudging, coaching, safety support). The codebase mirrors the exact requirements of the hackathon rules. |
| **Code quality** | Decoupled domain folders (coaching, insights, nudges, telemetry, db) separate concerns completely. No circular imports exist, variables have intention-revealing names, and linter-suppression comments are absent. |
| **Security** | Express rate-limiting blocks brute force and excessive API consumption per user session. Custom request payload sanitizers enforce strict type limits and string constraints. Cookies are handled securely on the server side. |
| **Efficiency** | Leverages an ordered fallback model chain (`tencent/hy3:free`, then `google/gemini-2.5-flash`, then `openrouter/free`) to guarantee uptime while minimizing API costs. Payloads are aggregated and compacted before being sent to the LLM. |
| **Testing** | **59 comprehensive unit tests** cover database migrations, validation logic, habit type rules, insight calculation, and API endpoint routing. All tests run safely using an isolated, fast `:memory:` SQLite instance. |
| **Accessibility** | Built with full semantic HTML markup (`<main>`, `<section>`, `<header>`, `<footer>`), an accessible skip-to-content link, high contrast UI styles (color contrast ratios exceeding 4.5:1), and a screen-reader-accessible table fallback for the SVG charts. |

---

## Run it

```bash
npm install            # Install dependencies
npm test               # Run the 59 passing unit tests
npm run dev            # Start the developer watch-server (http://localhost:3000)
```

### Enable the live AI (optional — the app has full local fallbacks)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and set your OpenRouter API Key:
   ```env
   OPENROUTER_API_KEY=your_openrouter_key_here
   ```
3. Set your preferred model chain (optional):
   ```env
   OPENROUTER_MODELS=tencent/hy3:free,google/gemini-2.5-flash,openrouter/free
   ```

With the key set, requests will hit OpenRouter for live reasoning. Without it, Brohab runs on standard local rule-based fallbacks and warns you in the server terminal, letting you test the entire app safely offline.

---

_Brohab is a habit-tracking and self-reflection helper using cognitive behavioral techniques. It does not provide medical advice, diagnosis, or treatment. Always seek the advice of a qualified healthcare provider for clinical addiction or mental health conditions._
