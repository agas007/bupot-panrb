import { NextResponse } from "next/server";

const tracker = new Map<string, { count: number; lastReset: number }>();

/**
 * Basic memory-based rate limiting helper for internal API protection.
 * Limit: 100 requests per 15 minutes per username.
 */
export async function applyRateLimit(req: Request, limit: number = 100, windowMs: number = 15 * 60 * 1000) {
  const username = req.headers.get("x-simulated-username") || "anonymous";
  const now = Date.now();
  
  const entry = tracker.get(username) || { count: 0, lastReset: now };

  if (now - entry.lastReset > windowMs) {
    entry.count = 0;
    entry.lastReset = now;
  }

  entry.count++;
  tracker.set(username, entry);

  if (entry.count > limit) {
    return NextResponse.json({ 
      error: "Rate limit exceeded. Try again in 15 minutes.",
      retryAfter: Math.ceil((entry.lastReset + windowMs - now) / 1000)
    }, { 
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((entry.lastReset + windowMs - now) / 1000))
      }
    });
  }

  return null;
}
