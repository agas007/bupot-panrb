import type { NextRequest } from "next/server";
import type { AuthSession } from "@/types";

export const SESSION_COOKIE_NAME = "bupot_session";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 60;

export type CookieSessionPayload = {
  user: AuthSession;
  issuedAt: number;
  expiresAt: number;
};

export const createCookieSessionValue = (user: AuthSession): string => {
  const payload: CookieSessionPayload = {
    user,
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_COOKIE_MAX_AGE_SECONDS * 1000,
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
};

export const parseCookieSessionValue = (value: string | undefined | null): CookieSessionPayload | null => {
  if (!value) return null;

  try {
    const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<CookieSessionPayload>;
    const user = payload.user;

    if (
      !user ||
      typeof user !== "object" ||
      typeof user.id !== "number" ||
      typeof user.name !== "string" ||
      typeof user.username !== "string" ||
      (user.role !== "ADMIN" && user.role !== "USER")
    ) {
      return null;
    }

    if (typeof payload.issuedAt !== "number" || typeof payload.expiresAt !== "number") {
      return null;
    }

    if (Date.now() >= payload.expiresAt) {
      return null;
    }

    return {
      user,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
};

export const getRequestSessionUser = (req: NextRequest): AuthSession | null => {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  return parseCookieSessionValue(cookie)?.user ?? null;
};
