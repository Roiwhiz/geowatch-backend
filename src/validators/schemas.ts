import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// GeoWatch — Request Validation Schemas (Zod)
//
// Every incoming request body is validated against these schemas before
// reaching the controller. Invalid requests are rejected with a 400 error
// before any database or agent logic runs.
// ─────────────────────────────────────────────────────────────────────────────

// ── Users ─────────────────────────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Must be a valid email address")
    .toLowerCase()
    .trim(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// ── Sessions ──────────────────────────────────────────────────────────────────

export const CreateSessionSchema = z.object({
  userId: z
    .string({ required_error: "userId is required" })
    .uuid("userId must be a valid UUID"),
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

// ── Chat ──────────────────────────────────────────────────────────────────────

export const ChatRequestSchema = z.object({
  query: z
    .string({ required_error: "Query is required" })
    .min(3, "Query must be at least 3 characters")
    .max(2000, "Query must not exceed 2000 characters")
    .trim(),
  sessionId: z
    .string({ required_error: "sessionId is required" })
    .uuid("sessionId must be a valid UUID"),
  locale: z.enum(["en", "fr", "ar", "es", "pt", "sw"]).default("en"),
});

export type ChatRequestInput = z.infer<typeof ChatRequestSchema>;

// ── Shared ────────────────────────────────────────────────────────────────────

export const UUIDParamSchema = z.object({
  id: z.string().uuid("Must be a valid UUID").optional(),
  sessionId: z.string().uuid("Must be a valid UUID").optional(),
  userId: z.string().uuid("Must be a valid UUID").optional(),
});
