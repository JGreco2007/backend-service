import express from "express";
import { config } from "./config";

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: config.NODE_ENV });
});

app.listen(config.PORT, () => {
  console.log(`[${config.NODE_ENV}] listening on port ${config.PORT}`);
});
