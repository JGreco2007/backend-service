export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  usedAt: Date | null;
  expiresAt: Date;
}

export interface PasswordResetStore {
  create(params: { userId: string; tokenHash: string; expiresAt: Date }): Promise<PasswordResetTokenRecord>;
  findByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  markUsed(tokenHash: string): Promise<void>;
}
