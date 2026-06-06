import cors from "cors";

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : [];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // allow server-to-server / mobile apps / curl
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some((allowed) => origin === allowed);

    if (isAllowed) {
      return callback(null, true);
    }

    return callback(null, false); // don't throw → prevents 500 on OPTIONS
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});
