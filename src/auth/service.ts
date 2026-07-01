import { config } from "../config";
import { signAccessToken } from "./jwt";
import { hashPassword, verifyPassword } from "./password";
import type { PasswordResetStore } from "./passwordResetStore";
import type { RefreshTokenStore } from "./refreshTokenStore";
import { generateOpaqueToken, hashToken } from "./token";
import type { UserRecord, UserStore } from "./userStore";

export interface AuthDeps {
  users: UserStore;
  refreshTokens: RefreshTokenStore;
  passwordResets: PasswordResetStore;
}

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
  }
}

function refreshTokenExpiry(): Date {
  return new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function passwordResetExpiry(): Date {
  return new Date(Date.now() + config.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);
}

async function issueTokenPair(deps: AuthDeps, user: UserRecord) {
  const accessToken = await signAccessToken({ sub: user.id, role: user.role });
  const rawRefreshToken = generateOpaqueToken();
  await deps.refreshTokens.create({
    userId: user.id,
    tokenHash: hashToken(rawRefreshToken),
    expiresAt: refreshTokenExpiry(),
  });
  return { accessToken, rawRefreshToken };
}

export async function register(deps: AuthDeps, params: { email: string; password: string }) {
  const existing = await deps.users.findByEmail(params.email);
  if (existing) throw new AuthError("Email already registered", 409);
  const passwordHash = await hashPassword(params.password);
  const user = await deps.users.create({ email: params.email, passwordHash });
  return issueTokenPair(deps, user);
}

export async function login(deps: AuthDeps, params: { email: string; password: string }) {
  const user = await deps.users.findByEmail(params.email);
  // Same error either way — don't reveal whether the email is registered.
  if (!user || !(await verifyPassword(user.passwordHash, params.password))) {
    throw new AuthError("Invalid email or password", 401);
  }
  return issueTokenPair(deps, user);
}

export async function refreshAccessToken(deps: AuthDeps, params: { rawRefreshToken: string }) {
  const tokenHash = hashToken(params.rawRefreshToken);
  const record = await deps.refreshTokens.findByHash(tokenHash);
  if (!record || record.revoked || record.expiresAt.getTime() <= Date.now()) {
    throw new AuthError("Refresh token is invalid, expired, or revoked", 401);
  }
  const user = await deps.users.findById(record.userId);
  if (!user) throw new AuthError("Refresh token is invalid, expired, or revoked", 401);
  const accessToken = await signAccessToken({ sub: user.id, role: user.role });
  return { accessToken };
}

export async function logout(deps: AuthDeps, params: { rawRefreshToken: string }) {
  await deps.refreshTokens.revokeByHash(hashToken(params.rawRefreshToken));
}

export async function logoutAllDevices(deps: AuthDeps, params: { userId: string }) {
  await deps.refreshTokens.revokeAllForUser(params.userId);
}

export async function changePassword(
  deps: AuthDeps,
  params: { userId: string; currentPassword: string; newPassword: string }
) {
  const user = await deps.users.findById(params.userId);
  if (!user) throw new AuthError("User not found", 404);
  if (!(await verifyPassword(user.passwordHash, params.currentPassword))) {
    throw new AuthError("Current password is incorrect", 401);
  }
  const newHash = await hashPassword(params.newPassword);
  await deps.users.updatePasswordHash(user.id, newHash);
  await deps.refreshTokens.revokeAllForUser(user.id);
}

export async function changeEmail(
  deps: AuthDeps,
  params: { userId: string; newEmail: string; currentPassword: string }
) {
  const user = await deps.users.findById(params.userId);
  if (!user) throw new AuthError("User not found", 404);
  if (!(await verifyPassword(user.passwordHash, params.currentPassword))) {
    throw new AuthError("Current password is incorrect", 401);
  }
  const existing = await deps.users.findByEmail(params.newEmail);
  if (existing && existing.id !== user.id) throw new AuthError("Email already in use", 409);
  await deps.users.updateEmail(user.id, params.newEmail);
  await deps.refreshTokens.revokeAllForUser(user.id);
}

export async function requestPasswordReset(deps: AuthDeps, params: { email: string }) {
  const user = await deps.users.findByEmail(params.email);
  // Behave identically whether or not the email is registered, so callers
  // can't use this endpoint to enumerate accounts.
  if (!user) return;
  const rawToken = generateOpaqueToken();
  await deps.passwordResets.create({
    userId: user.id,
    tokenHash: hashToken(rawToken),
    expiresAt: passwordResetExpiry(),
  });
  // TODO: send via a real email provider once one is configured. Logged here
  // so the flow is exercisable in local dev without one.
  console.log(`[password-reset] token for ${user.email}: ${rawToken}`);
}

export async function confirmPasswordReset(deps: AuthDeps, params: { rawToken: string; newPassword: string }) {
  const tokenHash = hashToken(params.rawToken);
  const record = await deps.passwordResets.findByHash(tokenHash);
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw new AuthError("Reset token is invalid, expired, or already used", 400);
  }
  const newHash = await hashPassword(params.newPassword);
  await deps.users.updatePasswordHash(record.userId, newHash);
  await deps.passwordResets.markUsed(tokenHash);
  await deps.refreshTokens.revokeAllForUser(record.userId);
}
