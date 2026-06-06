import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

const NODE_ENV = process.env.NODE_ENV ?? "development";
dotenv.config({
  path: `.env.${NODE_ENV}`,
});

// Extend global to store Prisma instance
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const connectionString = process.env.DATABASE_URL;

// Create Prisma client function
const createPrismaClient = () => {
  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });
};

// Singleton instance
export const prisma = globalThis.__prisma ?? createPrismaClient();

// Store globally in development
if (NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

// // ─────────────────────────────────────────────────────────────────────────────
// // Connection health check
// // Called on server startup to verify the database is reachable
// // before the server begins accepting requests.
// // ─────────────────────────────────────────────────────────────────────────────

export const testConnection = async () => {
  try {
    await prisma.$connect();
    logger.info("✅ Database connected successfully");
  } catch (error) {
    logger.error(error, "[Database] Connection failed");
  }
};

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info("[Database] Connected successfully");
  } catch (error) {
    logger.error(error, "[Database] Connection failed");
    // Exit the process — a server without a database is not useful
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info("[Database] Disconnected");
};
