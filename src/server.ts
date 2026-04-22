import dotenv from "dotenv";
const NODE_ENV = process.env.NODE_ENV ?? "development";
dotenv.config({
  path: `.env.${NODE_ENV}`,
});
import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/prisma";
import { connectRedis, disconnectRedis } from "./config/redis";
import { logger } from "./utils/logger";

const PORT = process.env.PORT ?? 5000;

const start = async (): Promise<void> => {
  await connectDatabase();
  await connectRedis();

  const app = createApp();

  const server = app.listen(PORT, () => {
    logger.info(`
  ┌─────────────────────────────────────────┐
  │         GeoWatch Backend                │
  ├─────────────────────────────────────────┤
  │  Status      : running                  │
  │  Environment : ${NODE_ENV.padEnd(25)}│
  │  Port        : ${String(PORT).padEnd(25)}│
  │  API Docs    : http://localhost:${PORT}/api-docs │
  └─────────────────────────────────────────┘
    `);
  });

  // ── Process-level crash prevention ──────────────────────────────────────
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled Promise Rejection");
    // Do not exit — let the request timeout naturally
  });

  process.on("uncaughtException", (error) => {
    logger.error({ error }, "Uncaught Exception — shutting down gracefully");
    server.close(() => process.exit(1));
    setTimeout(() => process.exit(1), 5000);
  });

  // ── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`[${signal}] Shutting down gracefully...`);
    server.close(async () => {
      await disconnectDatabase();
      await disconnectRedis();
      logger.info("All connections closed. Exiting.");
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

start().catch((error) => {
  logger.error(error, "[Startup] Fatal error:");
  process.exit(1);
});
