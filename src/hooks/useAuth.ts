"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AuthSession } from "@/types";
import { clearSession, readSessionUser, getSessionUser } from "@/lib/auth-session";

export function useAuth() {
  const [user, setUser] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const syncUser = useCallback(() => {
    if (typeof window === "undefined") return;
    const savedUser = readSessionUser();
    if (savedUser) {
      setUser(savedUser);
      setIsLoading(false);
      return;
    }

    void getSessionUser()
      .then((sessionUser) => {
        setUser(sessionUser);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    const initialize = window.setTimeout(syncUser, 0);
    // Re-sync if localStorage changes in other tabs
    window.addEventListener("storage", syncUser);
    return () => {
      window.clearTimeout(initialize);
      window.removeEventListener("storage", syncUser);
    };
  }, [syncUser]);

  const logout = useCallback(async () => {
    try {
      if (user) {
        await fetch("/api/auth/logout", {
          method: "POST",
          body: JSON.stringify({ username: user.username }),
        });
      }
    } catch (err) {
      console.error("Logout error:", err);
    }
    clearSession();
    setUser(null);
    router.push("/login");
  }, [user, router]);

  const isAdmin = user?.role === "ADMIN";

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (!user) return {};
    return {
      "x-simulated-user": user.name,
      "x-simulated-username": user.username
    };
  }, [user]);

  return {
    user,
    isAdmin,
    isLoading,
    logout,
    syncUser,
    getAuthHeaders
  };
}
