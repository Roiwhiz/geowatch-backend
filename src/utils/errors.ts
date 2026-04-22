export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, "validation_error", message, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      404,
      "not_found",
      id ? `${resource} '${id}' not found` : `${resource} not found`,
    );
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "conflict", message);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds?: number) {
    super(
      429,
      "rate_limit_exceeded",
      "AI service rate limit reached. Please wait before sending another request.",
      retryAfterSeconds ? { retryAfterSeconds } : undefined,
    );
    this.name = "RateLimitError";
  }
}

export class AIServiceError extends AppError {
  constructor(message: string, details?: unknown) {
    super(503, "ai_service_error", message, details);
    this.name = "AIServiceError";
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(503, "database_error", message);
    this.name = "DatabaseError";
  }
}

export class SessionBusyError extends AppError {
  constructor(sessionId: string) {
    super(
      409,
      "session_busy",
      `Session '${sessionId}' is already processing a request. Please wait.`,
    );
    this.name = "SessionBusyError";
  }
}

// Helper to extract retry-after from Gemini 429 error messages
export function parseRetryAfter(message: string): number | undefined {
  const match = message.match(/retry.*?(\d+(?:\.\d+)?)s/i);
  return match ? Math.ceil(parseFloat(match[1])) : undefined;
}

// Helper to classify Gemini errors into typed AppErrors
export function classifyGeminiError(error: Error): AppError {
  const msg = error.message;
  if (
    msg.includes("429") ||
    msg.includes("Too Many Requests") ||
    msg.includes("quota")
  ) {
    const retryAfter = parseRetryAfter(msg);
    return new RateLimitError(retryAfter);
  }

  if (msg.includes("503") || msg.includes("Service Unavailable")) {
    return new AIServiceError(
      "The AI service is temporarily unavailable. Please try again in a moment.",
    );
  }

  if (msg.includes("500") || msg.includes("Internal Server Error")) {
    return new AIServiceError(
      "The AI service encountered an internal error. Please try again.",
    );
  }

  if (msg.includes("400") || msg.includes("Bad Request")) {
    return new AIServiceError(
      "The AI service rejected the request. This may be due to content policy.",
      { originalMessage: msg },
    );
  }

  if (
    msg.includes("functionResponse") ||
    msg.includes("chat history") ||
    msg.includes("Content with role")
  ) {
    return new AIServiceError(
      "Conversation history error. Please start a new session.",
      { originalMessage: msg },
    );
  }

  return new AIServiceError(
    "An unexpected error occurred with the AI service.",
    { originalMessage: msg },
  );
}

// Helper to classify Prisma errors
export function classifyPrismaError(error: unknown): AppError {
  const e = error as { code?: string; message?: string };

  switch (e.code) {
    case "P2002":
      return new ValidationError("A record with this value already exists");
    case "P2025":
      return new NotFoundError("Record");
    case "P2003":
      return new ValidationError("Referenced record does not exist");
    case "P1001":
    case "P1002":
      return new DatabaseError(
        "Cannot connect to the database. Please try again.",
      );
    default:
      return new DatabaseError("A database error occurred. Please try again.");
  }
}
