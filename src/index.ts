import cookieParser from "cookie-parser";
import express from "express";
import { authRouter } from "./auth/routes";
import { config } from "./config";

const app = express();

app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: config.NODE_ENV });
});

app.use("/auth", authRouter);

app.listen(config.PORT, () => {
  console.log(`[${config.NODE_ENV}] listening on port ${config.PORT}`);
});
