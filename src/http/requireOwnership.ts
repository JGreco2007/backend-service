import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../auth/middleware";

export interface OwnedResource<T> {
  record: T;
  ownerId: string | null;
}

// Optional, like AuthenticatedRequest's `user` — a required property here
// would make handlers typed against it incompatible with Express's
// RequestHandler signature (which must accept any plain Request).
export type RequestWithResource<T> = AuthenticatedRequest & { resource?: T };

/**
 * Generic per-object authorization for any `/:id` endpoint. Loads the
 * resource via the supplied loader, then only lets the request through if
 * the caller is the resource's owner or an admin.
 *
 * Every rejection — resource doesn't exist, belongs to someone else, or has
 * no owner at all (e.g. an unassigned inquiry) — is a 404, not a 403. That's
 * deliberate: a 403 confirms the object exists, which is itself an
 * enumeration leak. Reusable across resource types by passing a different
 * loader; the authorization logic itself is written once, here.
 */
export function requireOwnership<T>(
  loadOwnedResource: (id: string, req: AuthenticatedRequest) => Promise<OwnedResource<T> | null>
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = String(req.params.id);
    let result: OwnedResource<T> | null;
    try {
      result = await loadOwnedResource(id, req);
    } catch (err) {
      next(err);
      return;
    }

    const isAdmin = req.user?.role === "admin";
    const isOwner = result !== null && result.ownerId !== null && result.ownerId === req.user?.id;

    if (!result || (!isAdmin && !isOwner)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    (req as RequestWithResource<T>).resource = result.record;
    next();
  };
}
