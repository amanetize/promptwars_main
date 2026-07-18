import { CRISIS_RESOURCES } from './crisisResources.js';

// No DB or LLM dependency — always reachable, even if the database or the
// LLM provider is down.
export function createSupportHandler() {
  return function getSupport(req, res) {
    return res.status(200).json({ resources: CRISIS_RESOURCES });
  };
}
