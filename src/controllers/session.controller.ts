import { Request, Response, NextFunction } from "express";
import { SessionService } from "../services/session.service";
import { MessageService } from "../services/message.service";
import { ReportService } from "../agent/report.service";
import { CreateSessionSchema } from "../validators/schemas";
import logger from "../utils/logger";
import { NotFoundError, ValidationError } from "../utils/errors";

// ─────────────────────────────────────────────────────────────────────────────
// Session Controller
// Handles session creation, retrieval, and message history loading.
// ─────────────────────────────────────────────────────────────────────────────

export const SessionController = {
  // POST /api/sessions
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = CreateSessionSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: "validation_error",
          message: "Invalid request body",
          details: result.error.flatten().fieldErrors,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const session = await SessionService.create(result.data);
      res.status(201).json(session);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/sessions/:sessionId
  async getById(
    req: Request<{ sessionId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = await SessionService.findById(sessionId);

      if (!session) {
        res.status(404).json({
          error: "session_not_found",
          message: `Session '${sessionId}' not found`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json(session);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/sessions/:sessionId/messages
  async getMessages(
    req: Request<{ sessionId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { sessionId } = req.params;

      // Verify session exists
      const session = await SessionService.findById(sessionId);
      if (!session) {
        res.status(404).json({
          error: "session_not_found",
          message: `Session '${sessionId}' not found`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const messages = await MessageService.loadHistory(sessionId);
      logger.info(messages, "[Database:]");
      res.json(messages);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/sessions/:sessionId/reports
  async getReports(
    req: Request<{ sessionId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { sessionId } = req.params;

      // Verify session exists
      const session = await SessionService.findById(sessionId);
      if (!session) {
        res.status(404).json({
          error: "session_not_found",
          message: `Session '${sessionId}' not found`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const reports = await SessionService.findReportsBySessionId(sessionId);
      res.json(reports);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/reports/:reportId
  async getReportById(
    req: Request<{ reportId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { reportId } = req.params;
      const report = await ReportService.findById(reportId);

      if (!report) {
        res.status(404).json({
          error: "report_not_found",
          message: `Report '${reportId}' not found`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json(report);
    } catch (error) {
      next(error);
    }
  },

  // DELETE /api/sessions/:sessionId
  async delete(
    req: Request<{ sessionId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = await SessionService.findById(sessionId);

      if (!session) {
        throw new NotFoundError("Session", sessionId);
      }

      await SessionService.delete(sessionId);

      res.status(200).json({
        success: true,
        message: "Session deleted successfully.",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },

  // PATCH /api/sessions/:sessionId/title
  async updateTitle(
    req: Request<{ sessionId: string }, { title: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { title } = req.body;

      if (!title || typeof title !== "string" || title.trim().length === 0) {
        throw new ValidationError("Title must be a non-empty string.");
      }

      if (title.trim().length > 255) {
        throw new ValidationError("Title must not exceed 255 characters.");
      }

      const session = await SessionService.findById(sessionId);
      if (!session) {
        throw new NotFoundError("Session", sessionId);
      }

      await SessionService.updateTitle(sessionId, title.trim());

      res.status(200).json({
        success: true,
        message: `Session renamed to successfully.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
};
