import type { ClientRateLimitInfo, Options, Store } from "express-rate-limit";

interface WindowRecord {
  windowIndex: number;
  previousCount: number;
  currentCount: number;
}

/**
 * A true sliding-window rate limit store.
 *
 * express-rate-limit's own built-in MemoryStore only implements a fixed
 * window (each key's count resets to zero the instant its window elapses),
 * which lets a client send up to ~2x the limit in a burst that straddles a
 * window boundary. This implements the sliding-window-counter algorithm
 * instead — the same approximation used by Cloudflare and Kong — by
 * blending the previous window's count into the current one, weighted by
 * how much of the previous window still falls inside the trailing view.
 * That's O(1) memory per key, unlike a sliding-window-log that stores every
 * request timestamp, and doesn't require Redis.
 */
export class SlidingWindowStore implements Store {
  localKeys = true;

  private readonly hits = new Map<string, WindowRecord>();
  private cleanupTimer: NodeJS.Timeout | undefined;

  // express-rate-limit calls init() with the real windowMs once it wires
  // this store up; the constructor arg exists so the algorithm can be
  // exercised directly in tests without going through a full limiter setup.
  constructor(private windowMs = 60_000) {}

  init(options: Options): void {
    this.windowMs = options.windowMs;
    // Sweep out keys that haven't been touched in over a window so memory
    // doesn't grow unboundedly with one-off callers. unref() so this timer
    // never keeps the process (or a test run) alive on its own.
    this.cleanupTimer = setInterval(() => this.sweep(), this.windowMs).unref();
  }

  async shutdown(): Promise<void> {
    clearInterval(this.cleanupTimer);
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = Date.now();
    const record = this.recordFor(key, now);
    record.currentCount += 1;
    const resetTime = new Date((record.windowIndex + 1) * this.windowMs);
    return { totalHits: Math.ceil(this.estimatedCount(record, now)), resetTime };
  }

  async decrement(key: string): Promise<void> {
    const record = this.hits.get(key);
    if (record) {
      record.currentCount = Math.max(0, record.currentCount - 1);
    }
  }

  async resetKey(key: string): Promise<void> {
    this.hits.delete(key);
  }

  async resetAll(): Promise<void> {
    this.hits.clear();
  }

  private windowIndexFor(timestamp: number): number {
    return Math.floor(timestamp / this.windowMs);
  }

  private recordFor(key: string, now: number): WindowRecord {
    const windowIndex = this.windowIndexFor(now);
    const existing = this.hits.get(key);

    if (!existing) {
      const record: WindowRecord = { windowIndex, previousCount: 0, currentCount: 0 };
      this.hits.set(key, record);
      return record;
    }

    if (existing.windowIndex === windowIndex) {
      return existing;
    }

    // Rolled into a new window since we last saw this key. If it was the
    // window immediately before this one, that window's count still
    // partially counts toward the sliding view; anything older than that
    // has fully aged out.
    existing.previousCount = existing.windowIndex === windowIndex - 1 ? existing.currentCount : 0;
    existing.currentCount = 0;
    existing.windowIndex = windowIndex;
    return existing;
  }

  private estimatedCount(record: WindowRecord, now: number): number {
    const elapsedInCurrentWindow = now - record.windowIndex * this.windowMs;
    const elapsedFraction = Math.min(1, Math.max(0, elapsedInCurrentWindow / this.windowMs));
    return record.previousCount * (1 - elapsedFraction) + record.currentCount;
  }

  private sweep(): void {
    const currentIndex = this.windowIndexFor(Date.now());
    for (const [key, record] of this.hits) {
      if (currentIndex - record.windowIndex > 1) {
        this.hits.delete(key);
      }
    }
  }
}
