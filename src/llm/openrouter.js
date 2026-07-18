const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class OpenRouterError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
  }
}

// Calls OpenRouter's chat completions endpoint with a strict JSON schema
// response format, and returns the parsed object. Throws OpenRouterError
// on any non-2xx response or malformed JSON reply, so callers can return a
// clean error to the client without leaking internals.
export async function requestStructuredCompletion({ apiKey, model, messages, jsonSchema, fetchImpl = fetch }) {
  const response = await fetchImpl(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: jsonSchema,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error(`OpenRouter request failed (${response.status}): ${detail}`);
    throw new OpenRouterError('The AI service is temporarily unavailable. Please try again.', response.status || 502);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new OpenRouterError('OpenRouter response missing content', 502);
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new OpenRouterError('OpenRouter response was not valid JSON', 502);
  }
}

// Tries each model in order (e.g. a free model first, then a paid one, then
// a catch-all free-model router) and returns the first successful result.
// A failure on one model — rate limit, account/key quota exhausted, that
// specific model being temporarily down — doesn't have to take the whole
// feature down. Throws the last error only if every model in the list fails.
export async function requestWithModelFallback({ apiKey, models, messages, jsonSchema, fetchImpl = fetch }) {
  if (!Array.isArray(models) || models.length === 0) {
    throw new OpenRouterError('No OPENROUTER_MODELS configured.', 500);
  }

  let lastError;
  for (const model of models) {
    try {
      return await requestStructuredCompletion({ apiKey, model, messages, jsonSchema, fetchImpl });
    } catch (err) {
      lastError = err;
      console.error(`Model "${model}" failed (${err.message}); trying next fallback if available.`);
    }
  }
  throw lastError;
}
