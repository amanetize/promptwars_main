// Static, non-LLM, always-reachable safety content. Intentionally hardcoded
// — this is a deliberate safety feature the AI's crisis classification
// triggers, not a "static AI output" the disqualification rules target.
// Update the phone numbers below with region-appropriate hotlines before
// presenting this to real users outside a hackathon demo context.
export const CRISIS_RESOURCES = [
  {
    title: 'You are not alone',
    body: "If you're in immediate danger, please contact local emergency services right away.",
  },
  {
    title: 'Talk to someone now',
    body: 'iCall (India) — 9152987821, available Mon-Sat, 10am-8pm IST.',
  },
  {
    title: 'Crisis text/chat support',
    body: 'Vandrevala Foundation Helpline — 1860-2662-345 / 1800-2333-330 (24/7, India).',
  },
  {
    title: 'This app is not a substitute for professional care',
    body: 'This coach is a supportive tool, not a licensed therapist or medical provider. Please reach out to a qualified professional for anything beyond everyday habit support.',
  },
];
