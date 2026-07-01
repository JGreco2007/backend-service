import { Router } from "express";
import { type AuthenticatedRequest, requireAuth } from "../auth/middleware";
import { idempotent } from "../http/idempotency/idempotent";
import type { IdempotencyStore } from "../http/idempotency/idempotencyStore";
import { pickAllowed } from "../http/pickAllowed";
import { requireOwnership, type RequestWithResource } from "../http/requireOwnership";
import {
  PROPERTY_WRITABLE_FIELDS,
  type PropertyRecord,
  type PropertyStore,
  type PropertyUpdateInput,
} from "./propertyStore";

export function createPropertiesRouter(deps: { properties: PropertyStore; idempotency: IdempotencyStore }) {
  const router = Router();

  const loadOwnedProperty = async (id: string) => {
    const record = await deps.properties.findById(id);
    return record ? { record, ownerId: record.createdBy } : null;
  };

  // Creating a listing is a side effect a network-retried request should
  // never duplicate — same reasoning as an order or a payment.
  router.post("/", requireAuth, idempotent(deps.idempotency, "POST /api/properties"), async (req: AuthenticatedRequest, res, next) => {
    try {
      const { title, priceCents } = req.body ?? {};
      if (typeof title !== "string" || typeof priceCents !== "number") {
        res.status(400).json({ error: "title and priceCents are required" });
        return;
      }
      // createdBy is set from the authenticated user, never from the body —
      // pickAllowed below can't smuggle it in even if a client tries.
      const patch = pickAllowed<PropertyUpdateInput>(req.body, PROPERTY_WRITABLE_FIELDS);
      const property = await deps.properties.create({ ...patch, title, priceCents, createdBy: req.user!.id });
      res.status(201).json(property);
    } catch (err) {
      next(err);
    }
  });

  router.get(
    "/:id",
    requireAuth,
    requireOwnership(loadOwnedProperty),
    (req: RequestWithResource<PropertyRecord>, res) => {
      res.json(req.resource!);
    }
  );

  router.put(
    "/:id",
    requireAuth,
    requireOwnership(loadOwnedProperty),
    async (req: RequestWithResource<PropertyRecord>, res, next) => {
      try {
        const { title, priceCents } = req.body ?? {};
        if (typeof title !== "string" || typeof priceCents !== "number") {
          res.status(400).json({ error: "title and priceCents are required for a full replace" });
          return;
        }
        const patch = pickAllowed<PropertyUpdateInput>(req.body, PROPERTY_WRITABLE_FIELDS);
        const updated = await deps.properties.update(req.resource!.id, patch);
        res.json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  router.patch(
    "/:id",
    requireAuth,
    requireOwnership(loadOwnedProperty),
    async (req: RequestWithResource<PropertyRecord>, res, next) => {
      try {
        const patch = pickAllowed<PropertyUpdateInput>(req.body, PROPERTY_WRITABLE_FIELDS);
        const updated = await deps.properties.update(req.resource!.id, patch);
        res.json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  router.delete(
    "/:id",
    requireAuth,
    requireOwnership(loadOwnedProperty),
    async (req: RequestWithResource<PropertyRecord>, res, next) => {
      try {
        await deps.properties.delete(req.resource!.id);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
