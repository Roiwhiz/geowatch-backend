import { Request, Response, NextFunction } from "express";
import { ChatRequestSchema } from "../validators/schemas";
import { SessionService } from "../services/session.service";
import { MessageService } from "../services/message.service";
import { LockService } from "../services/lock.service";
import { runAgentLoop } from "../agent/loop";
import { logger } from "../utils/logger";
import { NotFoundError, SessionBusyError } from "../utils/errors";

// ─────────────────────────────────────────────────────────────────────────────
// Chat Controller — POST /api/chat
// ─────────────────────────────────────────────────────────────────────────────

export const ChatController = {
  async chat(req: Request, res: Response, next: NextFunction): Promise<void> {
    // ── 1. Validate request body ─────────────────────────────────────────────
    const result = ChatRequestSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "validation_error",
        message: "Invalid request body",
        details: result.error.flatten().fieldErrors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { query, sessionId, locale } = result.data;
    let lockAcquired = false;

    try {
      // ── 2. Verify session exists ───────────────────────────────────────────
      const session = await SessionService.findById(sessionId);
      if (!session) {
        throw new NotFoundError("Session", sessionId);
      }

      // ── 3. Acquire session lock ────────────────────────────────────────────
      const acquired = await LockService.acquire(sessionId);
      if (!acquired) {
        throw new SessionBusyError(sessionId);
      }
      lockAcquired = true;

      // ── 4. Load message history ────────────────────────────────────────────
      const history = await MessageService.loadHistory(sessionId);
      const geminiHistory = MessageService.toGeminiFormat(history);

      // ── 5. Run the agent loop ──────────────────────────────────────────────
      logger.info(`[Chat] Starting agent run — session: ${sessionId}`);
      logger.info(`[Chat] Query: "${query}"`);

      const { reportId, rawOutput } = await runAgentLoop({
        sessionId,
        query,
        history: geminiHistory,
        locale,
      });

      logger.info(`[Chat] Agent run complete — report: ${reportId}`);

      // ── 6. Return the response ─────────────────────────────────────────────
      res.json({
        id: reportId,
        sessionId,
        role: "assistant",
        content: rawOutput,
        createdAt: new Date().toISOString(),
        reportId,
      });
    } catch (error) {
      next(error);
    } finally {
      // ── Always release the lock only if it was acquired ────────────────────
      if (lockAcquired) {
        await LockService.release(sessionId);
      }
    }
  },
};
