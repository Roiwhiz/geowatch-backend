import dotenv from "dotenv";
const NODE_ENV = process.env.NODE_ENV ?? "development";
dotenv.config({
  path: `.env.${NODE_ENV}`,
});
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { logger } from "../src/utils/logger";

logger.info("NODE_ENV:", process.env.NODE_ENV);
logger.info("Loaded env file:", `.env.${NODE_ENV}`);
logger.info("DATABASE_URL:", process.env.DATABASE_URL);

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const main = async (): Promise<void> => {
  logger.info("Seeding database...");

  // Create a test user
  const user = await prisma.user.upsert({
    where: { email: "dev@geowatch.local" },
    update: {},
    create: {
      email: "dev@geowatch.local",
      preferences: {
        defaultFramework: "realism",
        outputFormat: "full",
      },
    },
  });

  logger.info(`Created user: ${user.email} (${user.id})`);

  // Create an initial session for that user
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      title: "Development session",
    },
  });

  logger.info(`Created session: ${session.title} (${session.id})`);
  logger.info("Seed complete.");
};

main()
  .catch((error) => {
    logger.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
