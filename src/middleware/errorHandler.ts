import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";
import logger from "../utils/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Global error handler
//
// All errors thrown or passed to next() end up here.
// Produces consistent JSON error responses the frontend can rely on.
// ─────────────────────────────────────────────────────────────────────────────

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const timestamp = new Date().toISOString();

  // Known typed application error
  if (err instanceof AppError) {
    logger.warn(
      { statusCode: err.statusCode, code: err.code, path: req.path },
      err.message,
    );

    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      ...(err.details !== undefined && { details: err.details }),
      timestamp,
    });
    return;
  }

  // Prisma errors that were not caught at service level
  const prismaError = err as { code?: string; clientVersion?: string };
  if (prismaError.clientVersion || prismaError.code?.startsWith("P")) {
    logger.error(
      { code: prismaError.code, path: req.path },
      "Unhandled Prisma error",
    );
    res.status(503).json({
      error: "database_error",
      message: "A database error occurred. Please try again.",
      timestamp,
    });
    return;
  }

  // Gemini SDK errors that were not caught in the agent loop
  if (
    err.message?.includes("GoogleGenerativeAI") ||
    err.message?.includes("generativelanguage")
  ) {
    logger.error(
      { message: err.message, path: req.path },
      "Unhandled Gemini error",
    );

    if (err.message.includes("429") || err.message.includes("quota")) {
      res.status(429).json({
        error: "rate_limit_exceeded",
        message:
          "AI service rate limit reached. Please wait before sending another request.",
        timestamp,
      });
      return;
    }

    res.status(503).json({
      error: "ai_service_error",
      message: "The AI service encountered an error. Please try again.",
      timestamp,
    });
    return;
  }

  // Unknown / unexpected error — never expose internals in production
  logger.error(
    { err, path: req.path, method: req.method },
    "Unhandled internal error",
  );

  res.status(500).json({
    error: "internal_server_error",
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred. Please try again."
        : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    timestamp,
  });
}
