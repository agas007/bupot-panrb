import { NextResponse } from "next/server";

const tracker = new Map<string, { count: number; lastReset: number }>();

/**
 * Basic memory-based rate limiting helper for internal API protection.
 * Limit: 100 requests per 15 minutes per username.
 */
export async function applyRateLimit(req: Request, limit: number = 100, windowMs: number = 15 * 60 * 1000) {
  const username = req.headers.get("x-simulated-username") || "anonymous";
  const sessionScope = req.headers.get("x-import-session-id")?.trim();
  const scopeKey = sessionScope ? `${username}:${sessionScope}` : username;
  const now = Date.now();
  
  const entry = tracker.get(scopeKey) || { count: 0, lastReset: now };

  if (now - entry.lastReset >= windowMs) {
    entry.count = 0;
    entry.lastReset = now;
  }

  entry.count++;
  tracker.set(scopeKey, entry);

  if (entry.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((entry.lastReset + windowMs - now) / 1000));
    return NextResponse.json({ 
      error: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      retryAfter,
    }, { 
      status: 429,
      headers: {
        "Retry-After": String(retryAfter)
      }
    });
  }

  return null;
}
