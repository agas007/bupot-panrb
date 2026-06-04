import type { AuthSession } from "@/types";

export const SESSION_STORAGE_KEY = "sim_user";
export const SESSION_MAX_AGE_MS = 30 * 60 * 1000;

export interface StoredAuthSession {
  user: AuthSession;
  lastActivityAt: number;
}

const isAuthSession = (value: unknown): value is AuthSession => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AuthSession>;
  return (
    typeof candidate.id === "number" &&
    typeof candidate.name === "string" &&
    typeof candidate.username === "string" &&
    (candidate.role === "ADMIN" || candidate.role === "USER")
  );
};

const isStoredAuthSession = (value: unknown): value is StoredAuthSession => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredAuthSession>;
  return isAuthSession(candidate.user) && typeof candidate.lastActivityAt === "number";
};

export const createStoredSession = (user: AuthSession, lastActivityAt = Date.now()): StoredAuthSession => ({
  user,
  lastActivityAt,
});

export const saveSession = (user: AuthSession): StoredAuthSession => {
  const session = createStoredSession(user);
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

export const readSession = (): StoredAuthSession | null => {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (isStoredAuthSession(parsed)) {
      if (Date.now() - parsed.lastActivityAt > SESSION_MAX_AGE_MS) {
        clearSession();
        return null;
      }
      return parsed;
    }

    if (isAuthSession(parsed)) {
      const session = createStoredSession(parsed);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      return session;
    }

    clearSession();
    return null;
  } catch {
    clearSession();
    return null;
  }
};

export const readSessionUser = (): AuthSession | null => readSession()?.user ?? null;

export const touchSession = (): StoredAuthSession | null => {
  const session = readSession();
  if (!session) return null;

  const refreshed = {
    ...session,
    lastActivityAt: Date.now(),
  };

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(refreshed));
  return refreshed;
};
