import cookieParser from "cookie-parser";
import express from "express";
import { createAdminRouter } from "./admin/routes";
import { authRouter } from "./auth/routes";
import { config } from "./config";
import { createDrizzleInquiryStore } from "./db/inquiryStore";
import { createDrizzlePropertyStore } from "./db/propertyStore";
import { createDrizzleUserStore } from "./db/userStore";
import { createInquiriesRouter } from "./inquiries/routes";
import { createPropertiesRouter } from "./properties/routes";

const app = express();

app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: config.NODE_ENV });
});

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
