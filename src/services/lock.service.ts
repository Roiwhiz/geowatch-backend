import { redis } from "../config/redis";

// ─────────────────────────────────────────────────────────────────────────────
// Lock Service — Session Processing Lock
//
// Prevents two simultaneous agent runs on the same session.
// Uses Redis SET NX (set if not exists) with an expiry for safety.
//
// Design decisions:
// - TTL of 120s covers even slow agent runs (up to 10 tool calls)
// - If Redis is down, we fail OPEN (allow the request) rather than
//   fail closed (block all requests). Availability > strict consistency here.
// - The lock key includes the sessionId so locks are per-session,
//   not global — multiple users can run agents simultaneously.
// ─────────────────────────────────────────────────────────────────────────────

const LOCK_TTL_SECONDS = parseInt(process.env.LOCK_TTL_SECONDS ?? "120", 10);
const lockKey = (sessionId: string): string => `lock:session:${sessionId}`;

export const LockService = {
  // Attempt to acquire the lock for a session.
  // Returns true if acquired, false if already locked.
  async acquire(sessionId: string): Promise<boolean> {
    try {
      // SET key value NX EX seconds — atomic set-if-not-exists with expiry
      const result = await redis.set(
        lockKey(sessionId),
        "processing",
        "EX",
        LOCK_TTL_SECONDS,
        "NX",
      );
      // Redis returns 'OK' if set, null if key already existed
      return result === "OK";
    } catch (error) {
      // Redis unavailable — fail open
      console.warn("[LockService] Redis unavailable, skipping lock:", error);
      return true;
    }
  },

  // Release the lock after the agent turn completes.
  // MUST be called in a finally block — never rely on TTL expiry alone.
  async release(sessionId: string): Promise<void> {
    try {
      await redis.del(lockKey(sessionId));
    } catch (error) {
      console.warn("[LockService] Could not release lock:", error);
    }
  },

  // Check if a session is currently locked without acquiring.
  async isLocked(sessionId: string): Promise<boolean> {
    try {
      const value = await redis.get(lockKey(sessionId));
      return value !== null;
    } catch {
      return false;
    }
  },
};
