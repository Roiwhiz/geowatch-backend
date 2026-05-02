import { Request, Response, NextFunction } from "express";
import { SessionService } from "../services/session.service";
import { MessageService } from "../services/message.service";
import { ReportService } from "../agent/report.service";
import { NotFoundError, ValidationError } from "../utils/errors";

// ─────────────────────────────────────────────────────────────────────────────
// Session Controller
// Handles session creation, retrieval, and message history loading.
// ─────────────────────────────────────────────────────────────────────────────

export const SessionController = {
  // POST /api/sessions
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await SessionService.create(req.body);
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
      if (!session) throw new NotFoundError("sesssion", sessionId);
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
      if (!session) throw new NotFoundError("Session", sessionId);
      const messages = await MessageService.loadHistory(sessionId);
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
      if (!session) throw new NotFoundError("Session", sessionId);
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
      if (!report) throw new NotFoundError("Report", reportId);
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
