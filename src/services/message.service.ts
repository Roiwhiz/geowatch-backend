import { prisma } from "../config/prisma";
import { MessageRole } from "@prisma/client";
import { ResponseType } from "../agent/report.service";
// ─────────────────────────────────────────────────────────────────────────────
// Message Service
// Manages the message history for a session.
//
// This is the most performance-sensitive service — loadHistory() is called
// on EVERY agent turn to hydrate the context window. The indexed query on
// [sessionId, createdAt] in the schema ensures this stays fast.
// ─────────────────────────────────────────────────────────────────────────────

export interface MessageRecord {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  reportId?: string | null;
  responseType?: ResponseType | null;
}

// Shape Gemini expects for conversation history
export interface GeminiMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

export const MessageService = {
  // Save a single message to the database.
  async save(
    sessionId: string,
    role: MessageRole,
    content: string,
  ): Promise<MessageRecord> {
    return prisma.message.create({
      data: { sessionId, role, content },
    });
  },

  // Save a user message and assistant response in one transaction.
  // Using a transaction ensures both are written together or neither is —
  // we never want a user message saved without its corresponding response.
  async saveTurn(
    sessionId: string,
    userContent: string,
    assistantContent: string,
  ): Promise<void> {
    await prisma.$transaction([
      prisma.message.create({
        data: { sessionId, role: "user", content: userContent },
      }),
      prisma.message.create({
        data: { sessionId, role: "assistant", content: assistantContent },
      }),
    ]);
  },

  // Load the full message history for a session, ordered chronologically.
  // This is what gets sent to Gemini as conversation context.
  async loadHistory(sessionId: string): Promise<MessageRecord[]> {
    const messages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true, createdAt: true },
    });

    // Pull responseType from the Report table, not the Message table
    const reports = await prisma.report.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true, responseType: true },
    });

    const assistantMessages = messages.filter((m) => m.role === "assistant");
    const reportByIndex = new Map(
      assistantMessages.map((_, i) => [
        i,
        reports[i]
          ? { id: reports[i].id, responseType: reports[i].responseType }
          : null,
      ]),
    );

    let assistantIndex = 0;
    return messages.map((m) => {
      if (m.role === "assistant") {
        const report = reportByIndex.get(assistantIndex++);
        return {
          ...m,
          reportId: report?.id ?? null,
          responseType: report?.responseType ?? null,
        };
      }
      return { ...m, reportId: null, responseType: null };
    });
  },

  // Convert database messages to the format Gemini expects.
  // Gemini uses 'user' and 'model'. We map 'assistant' to 'model' and keep 'user' as is.
  toGeminiFormat(messages: MessageRecord[]): GeminiMessage[] {
    return messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));
  },

  // Count messages in a session — used to detect if this is the first
  // message (which triggers auto-title generation on the session).
  async count(sessionId: string): Promise<number> {
    return prisma.message.count({ where: { sessionId } });
  },
};
