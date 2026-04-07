"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AuthSession } from "@/types";

export function useAuth() {
  const [user, setUser] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const syncUser = useCallback(() => {
    if (typeof window === "undefined") return;
    const savedUser = localStorage.getItem("sim_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    } else {
      setUser(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    syncUser();
    // Re-sync if localStorage changes in other tabs
    window.addEventListener("storage", syncUser);
    return () => window.removeEventListener("storage", syncUser);
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
    localStorage.removeItem("sim_user");
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
