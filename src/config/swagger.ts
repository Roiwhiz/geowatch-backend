import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "GeoWatch API",
      version: "1.0.0",
      description: `
## GeoWatch — IR & Geopolitics AI Agent

GeoWatch is an autonomous geopolitical action agent that researches,
analyses, and produces structured intelligence outputs by searching
the web, querying conflict and trade databases, and applying
established IR frameworks.

### Authentication
All endpoints (except \`/health\`) require a valid session. 
Sessions are created via \`POST /api/sessions\`.

### Response format
Every agent response follows the structured report schema:
**BLUF → Background → Analysis → Implications → Sources**
      `,
      contact: {
        name: "GeoWatch",
      },
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Local development server",
      },
      {
        url: "https://your-app.onrender.com",
        description: "Production server (Render)",
      },
    ],
    components: {
      schemas: {
        // ── Shared response shapes ──────────────────────────
        HealthResponse: {
          type: "object",
          properties: {
            status: { type: "string", example: "ok" },
            environment: { type: "string", example: "development" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string", example: "not_found" },
            message: {
              type: "string",
              example: "The requested resource was not found",
            },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        // ── User ────────────────────────────────────────────
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        // ── Session ─────────────────────────────────────────
        Session: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            title: {
              type: "string",
              example: "Russia-Africa relations analysis",
            },
            createdAt: { type: "string", format: "date-time" },
            lastActiveAt: { type: "string", format: "date-time" },
          },
        },
        // ── Message ─────────────────────────────────────────
        Message: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            sessionId: { type: "string", format: "uuid" },
            role: { type: "string", enum: ["user", "assistant"] },
            content: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        // ── Report ──────────────────────────────────────────
        Report: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            sessionId: { type: "string", format: "uuid" },
            query: { type: "string" },
            frameworkUsed: {
              type: "string",
              enum: [
                "realism",
                "liberalism",
                "constructivism",
                "political_economy",
              ],
            },
            output: {
              type: "object",
              properties: {
                bluf: { type: "string" },
                background: { type: "string" },
                analysis: { type: "string" },
                implications: { type: "string" },
                sources: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      url: { type: "string" },
                      accessedAt: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
            partialSources: {
              type: "boolean",
              description: "True if one or more tools failed during generation",
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        // ── Chat request ────────────────────────────────────
        ChatRequest: {
          type: "object",
          required: ["query", "sessionId"],
          properties: {
            query: {
              type: "string",
              example: "What is the current state of Russia-Africa relations?",
            },
            sessionId: { type: "string", format: "uuid" },
          },
        },
      },
    },
  },
  // Scan all route files for JSDoc @swagger annotations
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
