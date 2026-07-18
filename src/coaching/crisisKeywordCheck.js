// Deterministic co-trigger alongside the model's own crisis_flag — defense
// in depth. Reliance on the model alone to classify crisis language is the
// single biggest domain risk in this app; this catches it even if a given
// completion under-classifies.
const CRISIS_PATTERNS = [
  /suicid/i,
  /kill myself/i,
  /end my life/i,
  /want to die/i,
  /hurt (myself|someone)/i,
  /overdose/i,
  /can'?t go on/i,
  /no reason to live/i,
  /self[- ]harm/i,
];

export function detectsCrisisLanguage(text) {
  if (typeof text !== 'string') return false;
  return CRISIS_PATTERNS.some((pattern) => pattern.test(text));
}
