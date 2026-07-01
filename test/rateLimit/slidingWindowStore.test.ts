import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlidingWindowStore } from "../../src/http/rateLimit/slidingWindowStore";

const WINDOW_MS = 1000;

describe("SlidingWindowStore", () => {
  let store: SlidingWindowStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    store = new SlidingWindowStore(WINDOW_MS);
  });

  afterEach(async () => {
    await store.shutdown();
    vi.useRealTimers();
  });

  it("counts hits within a single window", async () => {
    await store.increment("k");
    await store.increment("k");
    const info = await store.increment("k");
    expect(info.totalHits).toBe(3);
  });

  it("keys are independent of each other", async () => {
    await store.increment("a");
    await store.increment("a");
    const infoA = await store.increment("a");
    const infoB = await store.increment("b");
    expect(infoA.totalHits).toBe(3);
    expect(infoB.totalHits).toBe(1);
  });

  it("does not reset instantly at a window boundary (the fixed-window burst problem)", async () => {
    // 4 hits right at the end of window 0.
    vi.setSystemTime(WINDOW_MS - 10);
    await store.increment("k");
    await store.increment("k");
    await store.increment("k");
    const lastOfWindow0 = await store.increment("k");
    expect(lastOfWindow0.totalHits).toBe(4);

    // A fixed-window store would report totalHits=1 here, since the key's
    // count resets the instant the window elapses. The sliding-window
    // counter instead still weighs in almost all of the previous window's
    // 4 hits, because we're only 10ms into the new window.
    vi.setSystemTime(WINDOW_MS + 10);
    const firstOfWindow1 = await store.increment("k");
    expect(firstOfWindow1.totalHits).toBeGreaterThan(4);
  });

  it("fully decays the previous window's count by the time a full window has elapsed", async () => {
    await store.increment("k");
    await store.increment("k");
    await store.increment("k");

    vi.setSystemTime(WINDOW_MS * 2);
    const info = await store.increment("k");
    // Two full windows later, none of the original 3 hits should still count.
    expect(info.totalHits).toBe(1);
  });

  it("decrement lowers the current window's count, floored at zero", async () => {
    await store.increment("k");
    await store.decrement("k");
    await store.decrement("k");
    const info = await store.increment("k");
    expect(info.totalHits).toBe(1);
  });

  it("resetKey clears a single key without affecting others", async () => {
    await store.increment("a");
    await store.increment("b");
    await store.resetKey("a");
    const infoA = await store.increment("a");
    const infoB = await store.increment("b");
    expect(infoA.totalHits).toBe(1);
    expect(infoB.totalHits).toBe(2);
  });

  it("reports a resetTime at the end of the current window", async () => {
    const info = await store.increment("k");
    expect(info.resetTime?.getTime()).toBe(WINDOW_MS);
  });
});
