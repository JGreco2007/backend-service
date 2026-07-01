import { beforeEach, describe, expect, it } from "vitest";
import { verifyAccessToken } from "../src/auth/jwt";
import { createInMemoryPasswordResetStore } from "../src/auth/passwordResetStore.memory";
import { createInMemoryRefreshTokenStore } from "../src/auth/refreshTokenStore.memory";
import * as authService from "../src/auth/service";
import type { AuthDeps } from "../src/auth/service";
import { hashToken } from "../src/auth/token";
import { createInMemoryUserStore } from "../src/auth/userStore.memory";

const EMAIL = "buyer@example.com";
const PASSWORD = "hunter2hunter2";

describe("auth service", () => {
  let deps: AuthDeps;

  beforeEach(() => {
    deps = {
      users: createInMemoryUserStore(),
      refreshTokens: createInMemoryRefreshTokenStore(),
      passwordResets: createInMemoryPasswordResetStore(),
    };
  });

  it("a valid refresh token mints a new access token (control case)", async () => {
    const { rawRefreshToken } = await authService.register(deps, { email: EMAIL, password: PASSWORD });
    const { accessToken } = await authService.refreshAccessToken(deps, { rawRefreshToken });
    expect(verifyAccessToken(accessToken).sub).toBeTruthy();
  });

  it("a revoked refresh token can't mint a new access token", async () => {
    const { rawRefreshToken } = await authService.register(deps, { email: EMAIL, password: PASSWORD });

    await authService.logout(deps, { rawRefreshToken }); // marks it revoked

    await expect(authService.refreshAccessToken(deps, { rawRefreshToken })).rejects.toThrow(authService.AuthError);
  });

  it("an expired refresh token can't mint a new access token", async () => {
    const { rawRefreshToken: registrationToken } = await authService.register(deps, {
      email: EMAIL,
      password: PASSWORD,
    });
    const record = await deps.refreshTokens.findByHash(hashToken(registrationToken));
    const userId = record!.userId;

    // Insert a second refresh token that's already expired, bypassing the
    // service layer's TTL so we can assert on expiry specifically (not
    // revocation, which is covered separately above).
    const expiredRawToken = "expired-raw-token";
    await deps.refreshTokens.create({
      userId,
      tokenHash: hashToken(expiredRawToken),
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(authService.refreshAccessToken(deps, { rawRefreshToken: expiredRawToken })).rejects.toThrow(
      authService.AuthError
    );
  });

  it("logout-all-devices invalidates a token issued before the logout call", async () => {
    const { rawRefreshToken: deviceA } = await authService.register(deps, { email: EMAIL, password: PASSWORD });
    const { rawRefreshToken: deviceB } = await authService.login(deps, { email: EMAIL, password: PASSWORD });

    // Sanity check: both tokens work *before* logout-all-devices.
    const { accessToken } = await authService.refreshAccessToken(deps, { rawRefreshToken: deviceA });
    const { sub: userId } = verifyAccessToken(accessToken);
    await expect(authService.refreshAccessToken(deps, { rawRefreshToken: deviceB })).resolves.toBeTruthy();

    await authService.logoutAllDevices(deps, { userId });

    // Both tokens were issued *before* the logout-all-devices call and must
    // now be rejected — this is the case a naive "only revoke the token
    // used to call the endpoint" implementation would get wrong.
    await expect(authService.refreshAccessToken(deps, { rawRefreshToken: deviceA })).rejects.toThrow(
      authService.AuthError
    );
    await expect(authService.refreshAccessToken(deps, { rawRefreshToken: deviceB })).rejects.toThrow(
      authService.AuthError
    );
  });

  it("changing password revokes all existing refresh tokens", async () => {
    const { rawRefreshToken } = await authService.register(deps, { email: EMAIL, password: PASSWORD });
    const record = await deps.refreshTokens.findByHash(hashToken(rawRefreshToken));

    await authService.changePassword(deps, {
      userId: record!.userId,
      currentPassword: PASSWORD,
      newPassword: "a-different-strong-password",
    });

    await expect(authService.refreshAccessToken(deps, { rawRefreshToken })).rejects.toThrow(authService.AuthError);
  });

  it("changing email revokes all existing refresh tokens", async () => {
    const { rawRefreshToken } = await authService.register(deps, { email: EMAIL, password: PASSWORD });
    const record = await deps.refreshTokens.findByHash(hashToken(rawRefreshToken));

    await authService.changeEmail(deps, {
      userId: record!.userId,
      newEmail: "new-address@example.com",
      currentPassword: PASSWORD,
    });

    await expect(authService.refreshAccessToken(deps, { rawRefreshToken })).rejects.toThrow(authService.AuthError);
  });
});
