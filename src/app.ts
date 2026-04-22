import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";

import { corsMiddleware } from "./middleware/cors";
import { requestLogger } from "./middleware/requestLogger";
import { errorHandler } from "./middleware/errorHandler";
import { router } from "./routes/index";
import { swaggerSpec } from "./config/swagger";

export const createApp = (): express.Application => {
  const app = express();

  // ── Security ──────────────────────────────────────────
  // Helmet sets secure HTTP headers (XSS protection, no sniff, etc.)
  app.use(
    helmet({
      // Relax CSP so Swagger UI loads its own assets
      contentSecurityPolicy: process.env.NODE_ENV === "production",
    }),
  );

  // ── CORS ──────────────────────────────────────────────
  app.use(corsMiddleware);

  // ── Body parsing ──────────────────────────────────────
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // ── Request logging ───────────────────────────────────
  app.use(requestLogger);

  // ── Swagger UI ────────────────────────────────────────
  // Available at http://localhost:5000/api-docs
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: "GeoWatch API Docs",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: "list",
        filter: true,
      },
    }),
  );

  // Expose raw OpenAPI spec as JSON (useful for code generation tools)
  app.get("/api-docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  // ── Application routes ────────────────────────────────
  app.use(router);

  // ── 404 handler ───────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      error: "not_found",
      message: "The requested endpoint does not exist",
      timestamp: new Date().toISOString(),
    });
  });

  // ── Global error handler ──────────────────────────────
  // Must be last — Express identifies error handlers by their 4-argument signature
  app.use(errorHandler);

  return app;
};
