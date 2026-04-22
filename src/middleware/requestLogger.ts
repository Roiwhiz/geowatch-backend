import morgan from "morgan";

// Concise format in development, minimal in production
const format = process.env.NODE_ENV === "production" ? "tiny" : "dev";

export const requestLogger = morgan(format);
