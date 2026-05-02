-- CreateEnum
CREATE TYPE "ResponseType" AS ENUM ('report', 'conversational');

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "response_type" "ResponseType" NOT NULL DEFAULT 'report';
