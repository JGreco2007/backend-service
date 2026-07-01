import { Router } from "express";
import type { UserStore } from "../auth/userStore";
import { requireAuth } from "../auth/middleware";
import { requireRole } from "../http/requireRole";

const VALID_ROLES = ["admin", "agent"] as const;

export function createAdminRouter(deps: { users: UserStore }) {
  const router = Router();

  // Every route below is both authenticated AND role-gated — the role
  // check is centralized here, not repeated as an inline `if` per route.
  router.use(requireAuth, requireRole("admin"));

  router.get("/users", async (_req, res, next) => {
    try {
      const users = await deps.users.listAll();
      // Never return passwordHash, even to an admin.
      res.json(users.map(({ id, email, role }) => ({ id, email, role })));
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
