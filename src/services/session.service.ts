import { prisma } from "../config/prisma";
import { NotFoundError } from "../utils/errors";
import { CreateSessionInput } from "../validators/schemas";
import { Session } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Session Service
// Manages conversation sessions — creation, retrieval, and state updates.
// The session lock (processing flag) lives in Redis and is managed by
// the agent service. This service handles only database operations.
// ─────────────────────────────────────────────────────────────────────────────

export const SessionService = {
  // Create a new session for a user.
  async create(input: CreateSessionInput): Promise<Session> {
    // Verify the user exists before creating a session
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
    });

    if (!user) throw new NotFoundError("User", input.userId);
    return prisma.session.create({
      data: { userId: input.userId },
    });
  },

  // Fetch a session by ID. Returns null if not found.
  async findById(id: string): Promise<Session | null> {
    return prisma.session.findUnique({ where: { id } });
  },

  async setAutoTitle(id: string, firstQuery: string): Promise<void> {
    const title =
      firstQuery.length > 15
        ? firstQuery.substring(0, 15).trimEnd() + "..."
        : firstQuery;

    await prisma.session.update({
      where: { id },
      data: { title },
    });
  },
  // Update session title — auto-called after the first message in a session.
  async updateTitle(id: string, title: string): Promise<void> {
    await prisma.session.update({
      where: { id },
      data: { title },
    });
  },

  // Update lastActiveAt — called after every completed agent turn.
  async touch(id: string): Promise<void> {
    await prisma.session.update({
      where: { id },
      data: { lastActiveAt: new Date() },
    });
  },

  // Verify a session belongs to a specific user.
  // Used to prevent users from accessing other users' sessions.
  // async verifyOwnership(sessionId: string, userId: string): Promise<boolean> {
  //   const session = await prisma.session.findFirst({
  //     where: { id: sessionId, userId },
  //   });
  //   return session !== null;
  // },

  // Delete a session by ID.
  async delete(id: string): Promise<void> {
    await prisma.session.delete({ where: { id } });
  },

  // Fetch all reports belonging to a session.
  async findReportsBySessionId(sessionId: string) {
    return prisma.report.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
    });
  },
};
