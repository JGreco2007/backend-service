import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import type { UserStore } from "../auth/userStore";
import { requireAuth } from "../auth/middleware";
import { config } from "../config";
import { requireRole } from "../http/requireRole";
import { rateLimitExceededHandler } from "../http/rateLimit/handler";
import { ipKey } from "../http/rateLimit/keys";
import { SlidingWindowStore } from "../http/rateLimit/slidingWindowStore";
import { parsePagination } from "../http/pagination";

const VALID_ROLES = ["admin", "agent"] as const;

export function createAdminRouter(deps: { users: UserStore }) {
  const router = Router();

  // The one currently-expensive endpoint in this app: an unpaginated-by-
  // default full user listing. Nothing else here qualifies yet — no search,
  // report/export, or file-upload endpoints exist. Wire future ones to a
  // limiter built the same way (see general.ts / auth/rateLimit.ts).
  // Built per-router-instance, not at module scope, so each createAdminRouter()
  // call gets its own independent limiter — matters for tests, which build a
  // fresh router (and expect fresh rate-limit state) per test case.
  const adminListLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_ADMIN_LIST_WINDOW_MS,
    limit: config.RATE_LIMIT_ADMIN_LIST_MAX,
    store: new SlidingWindowStore(),
    keyGenerator: ipKey,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: rateLimitExceededHandler,
  });

  // Every route below is both authenticated AND role-gated — the role
  // check is centralized here, not repeated as an inline `if` per route.
  router.use(requireAuth, requireRole("admin"));

  router.get("/users", adminListLimiter, async (req, res, next) => {
    try {
      const { page, pageSize, limit, offset } = parsePagination(req.query, {
        defaultPageSize: config.DEFAULT_PAGE_SIZE,
        maxPageSize: config.MAX_PAGE_SIZE,
      });
      const users = await deps.users.listAll({ limit, offset });
      // Never return passwordHash, even to an admin.
      res.json({
        page,
        pageSize,
        users: users.map(({ id, email, role }) => ({ id, email, role })),
      });
    } catch (err) {
      next(err);
    }
  });

  // The only place a user's role can ever change. This is intentionally
  // separate from the self-service /auth/email and /auth/password
  // endpoints, whose allowlists never include `role`.
  router.patch("/users/:id/role", async (req, res, next) => {
    try {
      const { role } = req.body ?? {};
      if (typeof role !== "string" || !VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
        res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
        return;
      }
      const updated = await deps.users.updateRole(String(req.params.id), role);
      if (!updated) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json({ id: updated.id, email: updated.email, role: updated.role });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
