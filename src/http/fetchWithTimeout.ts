import { config } from "../config";

/**
 * fetch() with an AbortController-backed timeout, so a slow third-party API
 * or email/SMS provider can't hang the request that's waiting on it.
 *
 * Not wired to anything yet — this app has no outbound HTTP integrations
 * (no payment/email/SMS provider) at the time this was written. Use this for
 * the first one that gets added, rather than a bare `fetch()` call.
 */
export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs: number = config.OUTBOUND_HTTP_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
