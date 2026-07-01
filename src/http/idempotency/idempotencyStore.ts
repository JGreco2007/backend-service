export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  // Null while the original request is still being handled.
  responseStatus: number | null;
  responseBody: unknown | null;
  expiresAt: Date;
}

export interface IdempotencyStore {
  /**
   * Atomically claims a key: if nothing exists for it yet, creates a
   * placeholder row and returns null (the caller "won" the claim and should
   * proceed). If something already exists — completed or still in flight —
   * returns it instead, without creating anything.
   */
  claim(params: { key: string; requestHash: string; expiresAt: Date }): Promise<IdempotencyRecord | null>;

  /** Fills in the response for a key this process previously claimed. */
  complete(key: string, response: { status: number; body: unknown }): Promise<void>;

  /**
   * Releases a claim that ended in a non-2xx response (a validation error,
   * etc.) rather than a completed side effect. Without this, a client that
   * fixes their request and retries with the same key would be stuck seeing
   * "already in progress" forever — the request that failed didn't actually
   * do anything worth remembering.
   */
  release(key: string): Promise<void>;
}
