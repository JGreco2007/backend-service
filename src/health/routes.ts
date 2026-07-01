import { Router } from "express";
import { config } from "../config";
import { logger } from "../logging/logger";
import { withTimeout } from "../http/withTimeout";

export interface HealthDeps {
  checkDatabase: () => Promise<void>;
}

export function createHealthRouter(deps: HealthDeps) {
  const router = Router();

  // Liveness: is the process up and responding at all? No dependencies
  // checked — kept cheap and fast so it's safe to poll often, and exempt
  // from rate limiting (mounted before the general limiters in index.ts).
  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Readiness: can this instance actually serve traffic right now? Bounded
  // by a timeout so a hung DB doesn't hang the health check itself — the
  // one thing a load balancer needs least is its health probe blocking.
  router.get("/health/ready", async (_req, res) => {
    try {
      await withTimeout(deps.checkDatabase(), config.HEALTH_CHECK_DB_TIMEOUT_MS, "database readiness check");
      res.json({ status: "ok" });
    } catch (err) {
      logger.error({ err }, "readiness check failed");
      res.status(503).json({ status: "error" });
    }
  });

  return router;
}
