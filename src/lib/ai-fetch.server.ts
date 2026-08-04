// Shared retry helper for AI provider calls.
// Providers (especially the free Gemini tier used on Vercel) intermittently
// return 503 UNAVAILABLE / 429 / 5xx. Those are transient: retry with backoff,
// then fall back to an alternate model before surfacing an error.

const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type AiFetchResult = { ok: true; json: unknown } | { ok: false; status: number; text: string };

export async function fetchAiWithRetry(
  makeRequest: () => Promise<Response>,
  { attempts = 3, baseDelayMs = 800 }: { attempts?: number; baseDelayMs?: number } = {},
): Promise<AiFetchResult> {
  let last: { status: number; text: string } = { status: 0, text: "No response from AI provider." };

  for (let i = 0; i < attempts; i++) {
    let res: Response;
    try {
      res = await makeRequest();
    } catch (e) {
      last = { status: 0, text: e instanceof Error ? e.message : "Network error" };
      if (i < attempts - 1) await sleep(baseDelayMs * 2 ** i);
      continue;
    }

    if (res.ok) return { ok: true, json: await res.json() };

    const text = await res.text();
    last = { status: res.status, text };
    if (!RETRYABLE.has(res.status) || i === attempts - 1) break;
    await sleep(baseDelayMs * 2 ** i);
  }

  return { ok: false, ...last };
}

export function isTransientAiStatus(status: number) {
  return status === 0 || RETRYABLE.has(status);
}

export function aiErrorMessage(status: number, text: string) {
  if (status === 429) return "The AI is busy right now (rate limit). Please try again in a moment.";
  if (status === 402) return "AI credits exhausted. Add credits in workspace settings.";
  if (isTransientAiStatus(status))
    return "The AI service is temporarily overloaded. Please try again in a few seconds.";
  return `AI error: ${text.slice(0, 200)}`;
}
