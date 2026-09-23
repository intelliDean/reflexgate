import { HttpRequestResult } from './types.js';

/**
 * Sends a resilient JSON POST request with configurable timeout.
 */
export async function sendJsonPost(
  url: string,
  body: any,
  headers: Record<string, string> = {},
  timeoutMs: number = 8000
): Promise<HttpRequestResult> {
  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return {
      ok: res.ok,
      statusCode: res.status,
      latencyMs: Math.round(performance.now() - start)
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      error: err.name === 'AbortError' ? `Request timed out after ${timeoutMs}ms` : err.message,
      latencyMs: Math.round(performance.now() - start)
    };
  }
}
