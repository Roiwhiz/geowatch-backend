// src/services/quota.service.ts
import { redis } from "../config/redis";

const DAILY_LIMIT = parseInt(process.env.GEMINI_DAILY_LIMIT ?? "200", 10); // conservative buffer below 250
const KEY = () => `gemini:daily:${new Date().toISOString().slice(0, 10)}`;

export const QuotaService = {
  async increment(): Promise<number> {
    const key = KEY();
    const count = await redis.incr(key);
    // Set TTL to 25 hours on first increment so it expires after the day resets
    if (count === 1) await redis.expire(key, 90000);
    return count;
  },

  async isExhausted(): Promise<boolean> {
    const key = KEY();
    const count = parseInt((await redis.get(key)) ?? "0", 10);
    return count >= DAILY_LIMIT;
  },
};
