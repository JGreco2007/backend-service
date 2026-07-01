import cookieParser from "cookie-parser";
import express from "express";
import { createAdminRouter } from "./admin/routes";
import { attachUserIfPresent } from "./auth/middleware";
import { authRouter } from "./auth/routes";
import { config } from "./config";
import { createDrizzleInquiryStore } from "./db/inquiryStore";
import { createDrizzlePropertyStore } from "./db/propertyStore";
import { createDrizzleUserStore } from "./db/userStore";
import { generalAccountLimiter, generalIpLimiter } from "./http/rateLimit/general";
import { createInquiriesRouter } from "./inquiries/routes";
import { createPropertiesRouter } from "./properties/routes";

const app = express();

// Must be set before any middleware reads req.ip / X-Forwarded-For — see
// TRUST_PROXY_HOPS in src/config/schema.ts for why the exact value matters.
app.set("trust proxy", config.TRUST_PROXY_HOPS);

app.use(express.json({ limit: config.BODY_SIZE_LIMIT }));
app.use(cookieParser());

// Registered before the general rate limiters so load-balancer/uptime health
// checks are never throttled.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: config.NODE_ENV });
});

// Identifies the caller (if a valid access token is present) before the
// per-account limiter runs, without rejecting anonymous requests — that's
// requireAuth's job, per-route, further down the chain.
app.use(attachUserIfPresent);
app.use(generalIpLimiter);
app.use(generalAccountLimiter);

const users = createDrizzleUserStore();
const properties = createDrizzlePropertyStore();
const inquiries = createDrizzleInquiryStore();

app.use("/auth", authRouter);
app.use("/api/properties", createPropertiesRouter({ properties }));
app.use("/api/inquiries", createInquiriesRouter({ inquiries, properties }));
app.use("/api/admin", createAdminRouter({ users }));

app.listen(config.PORT, () => {
  console.log(`[${config.NODE_ENV}] listening on port ${config.PORT}`);
});
