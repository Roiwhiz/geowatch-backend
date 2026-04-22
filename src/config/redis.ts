import Redis from "ioredis";
import { logger } from "../utils/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Redis Client Singleton
//
// Redis handles two things in GeoWatch:
//   1. Session locks — prevents duplicate agent runs on the same session
//   2. Tool result cache — avoids repeated identical tool calls
//
// Same singleton pattern as the Prisma client — one instance shared across
// the application, guarded against hot-reload duplication in development.
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

const createRedisClient = (): Redis => {
  const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    // Retry connection up to 3 times with increasing delay
    retryStrategy: (times: number) => {
      if (times > 3) return null; // Stop retrying after 3 attempts
      return Math.min(times * 500, 2000);
    },
    // Fail fast if Redis is unreachable — don't block the agent loop
    connectTimeout: 5000,
    lazyConnect: true,
  });

  client.on("connect", () => {
    logger.info("[Redis] Connected successfully");
  });

  client.on("error", (error: Error) => {
    // Log but don't crash — Redis failure degrades gracefully
    // (session locks become unavailable but the agent still runs)
    logger.error(error, "[Redis] Connection error");
  });

  return client;
};

export const redis: Redis = globalThis.__redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
}

export const connectRedis = async (): Promise<void> => {
  try {
    await redis.connect();
  } catch (error) {
    // Redis is not critical enough to abort server startup
    // The session lock service handles Redis unavailability gracefully
    logger.warn(
      "[Redis] Could not connect — session locking will be unavailable",
    );
  }
};

export const disconnectRedis = async (): Promise<void> => {
  await redis.quit();
  logger.info("[Redis] Disconnected");
};
