import { Router, type Response } from "express";
import { config } from "../config";
import { createDrizzlePasswordResetStore } from "../db/passwordResetStore";
import { createDrizzleRefreshTokenStore } from "../db/refreshTokenStore";
import { createDrizzleUserStore } from "../db/userStore";
import { type AuthenticatedRequest, requireAuth } from "./middleware";
import { loginRateLimiters, passwordResetRateLimiters, registerRateLimiters } from "./rateLimit";
import * as authService from "./service";
import type { AuthDeps } from "./service";

const deps: AuthDeps = {
  users: createDrizzleUserStore(),
  refreshTokens: createDrizzleRefreshTokenStore(),
  passwordResets: createDrizzlePasswordResetStore(),
};

const REFRESH_COOKIE_NAME = "refresh_token";
const MIN_PASSWORD_LENGTH = 8;

function isValidNewPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= MIN_PASSWORD_LENGTH;
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    // Browsers won't send Secure cookies over plain http://localhost during
    // local dev; everywhere else this must be true.
    secure: config.NODE_ENV !== "local",
    sameSite: "lax" as const,
    path: "/auth",
    maxAge: config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

function setRefreshCookie(res: Response, rawRefreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, rawRefreshToken, refreshCookieOptions());
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/auth" });
}

export const authRouter = Router();

authRouter.post("/register", ...registerRateLimiters, async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || !isValidNewPassword(password)) {
      res.status(400).json({ error: `email and password (min ${MIN_PASSWORD_LENGTH} chars) are required` });
      return;
    }
    const { accessToken, rawRefreshToken } = await authService.register(deps, { email, password });
    setRefreshCookie(res, rawRefreshToken);
    res.status(201).json({ accessToken });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", ...loginRateLimiters, async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "email and password are required" });
      return;
    }
    const { accessToken, rawRefreshToken } = await authService.login(deps, { email, password });
    setRefreshCookie(res, rawRefreshToken);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (typeof rawRefreshToken !== "string") {
      res.status(401).json({ error: "Missing refresh token" });
      return;
    }
    const { accessToken } = await authService.refreshAccessToken(deps, { rawRefreshToken });
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (typeof rawRefreshToken === "string") {
      await authService.logout(deps, { rawRefreshToken });
    }
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout-all-devices", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    await authService.logoutAllDevices(deps, { userId: req.user!.id });
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.patch("/password", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== "string" || !isValidNewPassword(newPassword)) {
      res.status(400).json({ error: `currentPassword and newPassword (min ${MIN_PASSWORD_LENGTH} chars) are required` });
      return;
    }
    await authService.changePassword(deps, { userId: req.user!.id, currentPassword, newPassword });
    // changePassword revokes every refresh token for this user, including
    // the one behind this cookie — clear it so the client doesn't keep
    // sending a dead token.
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.patch("/email", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { newEmail, currentPassword } = req.body ?? {};
    if (typeof newEmail !== "string" || typeof currentPassword !== "string") {
      res.status(400).json({ error: "newEmail and currentPassword are required" });
      return;
    }
    await authService.changeEmail(deps, { userId: req.user!.id, newEmail, currentPassword });
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.post("/password-reset/request", ...passwordResetRateLimiters, async (req, res, next) => {
  try {
    const { email } = req.body ?? {};
    if (typeof email !== "string") {
      res.status(400).json({ error: "email is required" });
      return;
    }
    await authService.requestPasswordReset(deps, { email });
    // Same response whether or not the email is registered — don't let this
    // endpoint be used to enumerate accounts.
    res.status(202).json({ message: "If that email is registered, a reset link has been sent." });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/password-reset/confirm", ...passwordResetRateLimiters, async (req, res, next) => {
  try {
    const { token, newPassword } = req.body ?? {};
    if (typeof token !== "string" || !isValidNewPassword(newPassword)) {
      res.status(400).json({ error: `token and newPassword (min ${MIN_PASSWORD_LENGTH} chars) are required` });
      return;
    }
    await authService.confirmPasswordReset(deps, { rawToken: token, newPassword });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  res.json({ id: req.user!.id, role: req.user!.role });
});
