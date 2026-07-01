export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  revoked: boolean;
  expiresAt: Date;
}

/**
 * Abstracts refresh-token persistence so the auth service can be unit
 * tested against an in-memory fake instead of a live Postgres instance.
 */
export interface RefreshTokenStore {
  create(params: { userId: string; tokenHash: string; expiresAt: Date }): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeByHash(tokenHash: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}
