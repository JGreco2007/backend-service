import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { pickAllowed } from "../http/pickAllowed";
import { requireOwnership, type RequestWithResource } from "../http/requireOwnership";
import type { PropertyStore } from "../properties/propertyStore";
import {
  INQUIRY_WRITABLE_FIELDS,
  type InquiryRecord,
  type InquiryStore,
  type InquiryUpdateInput,
} from "./inquiryStore";

export function createInquiriesRouter(deps: { inquiries: InquiryStore; properties: PropertyStore }) {
  const router = Router();

  const loadOwnedInquiry = async (id: string) => {
    const record = await deps.inquiries.findById(id);
    if (!record) return null;
    if (!record.propertyId) {
      // Not tied to any listing — no agent owns it, so only the admin
      // bypass in requireOwnership can reach it (null ownerId never
      // matches any user id).
      return { record, ownerId: null };
    }
    const property = await deps.properties.findById(record.propertyId);
    return { record, ownerId: property?.createdBy ?? null };
  };

  // Public: the site's contact form posts here directly, no auth involved.
  router.post("/", async (req, res, next) => {
    try {
      const { name, email, propertyId, phone, message } = req.body ?? {};
      if (typeof name !== "string" || typeof email !== "string") {
        res.status(400).json({ error: "name and email are required" });
        return;
      }
      const inquiry = await deps.inquiries.create({
        name,
        email,
        propertyId: typeof propertyId === "string" ? propertyId : undefined,
        phone: typeof phone === "string" ? phone : undefined,
        message: typeof message === "string" ? message : undefined,
      });
      res.status(201).json(inquiry);
    } catch (err) {
      next(err);
    }
  });

  router.get(
    "/:id",
    requireAuth,
    requireOwnership(loadOwnedInquiry),
    (req: RequestWithResource<InquiryRecord>, res) => {
      res.json(req.resource!);
    }
  );

  router.put(
    "/:id",
    requireAuth,
    requireOwnership(loadOwnedInquiry),
    async (req: RequestWithResource<InquiryRecord>, res, next) => {
      try {
        const { status } = req.body ?? {};
        if (typeof status !== "string") {
          res.status(400).json({ error: "status is required for a full replace" });
          return;
        }
        const patch = pickAllowed<InquiryUpdateInput>(req.body, INQUIRY_WRITABLE_FIELDS);
        const updated = await deps.inquiries.update(req.resource!.id, patch);
        res.json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  router.patch(
    "/:id",
    requireAuth,
    requireOwnership(loadOwnedInquiry),
    async (req: RequestWithResource<InquiryRecord>, res, next) => {
      try {
        const patch = pickAllowed<InquiryUpdateInput>(req.body, INQUIRY_WRITABLE_FIELDS);
        const updated = await deps.inquiries.update(req.resource!.id, patch);
        res.json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  router.delete(
    "/:id",
    requireAuth,
    requireOwnership(loadOwnedInquiry),
    async (req: RequestWithResource<InquiryRecord>, res, next) => {
      try {
        await deps.inquiries.delete(req.resource!.id);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
