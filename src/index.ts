import cookieParser from "cookie-parser";
import express from "express";
import { createAdminRouter } from "./admin/routes";
import { attachUserIfPresent } from "./auth/middleware";
import { authRouter } from "./auth/routes";
import { config } from "./config";
import { checkDatabase } from "./db/client";
import { createDrizzleIdempotencyStore } from "./db/idempotencyStore";
import { createDrizzleInquiryStore } from "./db/inquiryStore";
import { createDrizzlePropertyStore } from "./db/propertyStore";
import { createDrizzleUserStore } from "./db/userStore";
import { createHealthRouter } from "./health/routes";
import { errorHandler } from "./http/errorHandler";
import { generalAccountLimiter, generalIpLimiter } from "./http/rateLimit/general";
import { createInquiriesRouter } from "./inquiries/routes";
import { httpLogger } from "./logging/httpLogger";
import { logger } from "./logging/logger";
import { createPropertiesRouter } from "./properties/routes";

const app = express();

// Must be set before any middleware reads req.ip / X-Forwarded-For — see
// TRUST_PROXY_HOPS in src/config/schema.ts for why the exact value matters.
app.set("trust proxy", config.TRUST_PROXY_HOPS);

app.use(httpLogger);
app.use(express.json({ limit: config.BODY_SIZE_LIMIT }));
app.use(cookieParser());

// Registered before the general rate limiters so load-balancer/uptime
// checks are never throttled.
app.use(createHealthRouter({ checkDatabase }));

// Identifies the caller (if a valid access token is present) before the
// per-account limiter runs, without rejecting anonymous requests — that's
// requireAuth's job, per-route, further down the chain.
app.use(attachUserIfPresent);
app.use(generalIpLimiter);
app.use(generalAccountLimiter);

const users = createDrizzleUserStore();
const properties = createDrizzlePropertyStore();
const inquiries = createDrizzleInquiryStore();
const idempotency = createDrizzleIdempotencyStore();

app.use("/auth", authRouter);
app.use("/api/properties", createPropertiesRouter({ properties, idempotency }));
app.use("/api/inquiries", createInquiriesRouter({ inquiries, properties, idempotency }));
app.use("/api/admin", createAdminRouter({ users }));

// Must be registered last — Express only routes to a 4-arg middleware when
// something upstream called next(err).
app.use(errorHandler);

app.listen(config.PORT, () => {
  logger.info({ env: config.NODE_ENV, port: config.PORT }, "server listening");
});
