import cors from "cors";

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:5000",
  "http://localhost:3001",
  "https://geowatch-frontend.vercel.app",
].filter(Boolean) as string[];

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

