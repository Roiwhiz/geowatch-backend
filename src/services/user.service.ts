import { prisma } from "../config/prisma";
import { CreateUserInput } from "../validators/schemas";
import type { User } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// User Service
// All database operations related to users live here.
// Controllers call these methods — they never touch db directly.
// ─────────────────────────────────────────────────────────────────────────────

export const UserService = {
  // Create a new user. Throws if email already exists.
  async create(input: CreateUserInput): Promise<User> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      const error: Error & { statusCode?: number; code?: string } = new Error(
        `User with email '${input.email}' already exists`,
      );
      error.statusCode = 409;
      error.code = "user_already_exists";
      throw error;
    }

    return prisma.user.create({
      data: { email: input.email },
    });
  },

  // Fetch a single user by ID. Returns null if not found.
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  // Fetch a single user by email. Returns null if not found.
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  // Fetch all sessions belonging to a user (for the sidebar).
  async findSessionsByUserId(userId: string) {
    return prisma.session.findMany({
      where: { userId },
      orderBy: { lastActiveAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });
  },

  async identify(email: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { ...existing, isNew: false };
    const created = await prisma.user.create({ data: { email } });
    return { ...created, isNew: true };
  },
};
