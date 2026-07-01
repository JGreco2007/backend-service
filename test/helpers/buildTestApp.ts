import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import { createAdminRouter } from "../../src/admin/routes";
import type { UserStore } from "../../src/auth/userStore";
import { errorHandler } from "../../src/http/errorHandler";
import { createInMemoryIdempotencyStore } from "../../src/http/idempotency/idempotencyStore.memory";
import type { IdempotencyStore } from "../../src/http/idempotency/idempotencyStore";
import { createInquiriesRouter } from "../../src/inquiries/routes";
import type { InquiryStore } from "../../src/inquiries/inquiryStore";
import { createPropertiesRouter } from "../../src/properties/routes";
import type { PropertyStore } from "../../src/properties/propertyStore";

export interface TestStores {
  users: UserStore;
  properties: PropertyStore;
  inquiries: InquiryStore;
  idempotency?: IdempotencyStore;
}

/** Builds a real Express app, wired to in-memory stores, for HTTP-level tests. */
export function buildTestApp(stores: TestStores): Express {
  const idempotency = stores.idempotency ?? createInMemoryIdempotencyStore();
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/properties", createPropertiesRouter({ properties: stores.properties, idempotency }));
  app.use(
    "/api/inquiries",
    createInquiriesRouter({ inquiries: stores.inquiries, properties: stores.properties, idempotency })
  );
  app.use("/api/admin", createAdminRouter({ users: stores.users }));
  app.use(errorHandler);
  return app;
}
