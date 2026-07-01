export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
}

export interface UserStore {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(params: { email: string; passwordHash: string }): Promise<UserRecord>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
  updateEmail(id: string, email: string): Promise<void>;
}
