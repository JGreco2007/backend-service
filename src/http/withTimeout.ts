/**
 * Races any promise against a timeout, so a hung dependency (DB, third-party
 * API, ...) can't hang the request indefinitely. The underlying operation
 * isn't cancelled — this just stops *waiting* on it — so callers should
 * still use a mechanism that can actually abort work where one exists (see
 * fetchWithTimeout for outbound HTTP).
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
