import type { UserRole } from "@/types";

export const VALID_USER_ROLES = ["ADMIN", "ARCHIVIST", "USER"] as const;
const ROLE_PRIORITY: UserRole[] = ["ADMIN", "ARCHIVIST", "USER"];

export const isValidUserRole = (role: unknown): role is UserRole => {
  return role === "ADMIN" || role === "ARCHIVIST" || role === "USER";
};

const normalizeRoleTokens = (roleOrRoles: unknown): string[] => {
  if (Array.isArray(roleOrRoles)) {
    return roleOrRoles.flatMap((item) => normalizeRoleTokens(item));
  }

  if (typeof roleOrRoles === "string") {
    const raw = roleOrRoles.trim();
    if (!raw) return [];

    if (raw.startsWith("[") && raw.endsWith("]")) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.flatMap((item) => normalizeRoleTokens(item));
        }
      } catch {
        // fall through to delimiter parsing
      }
    }

    return raw
      .split(/[|,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (roleOrRoles && typeof roleOrRoles === "object") {
    const candidate = roleOrRoles as { role?: unknown; roles?: unknown };
    if (candidate.roles !== undefined) {
      return normalizeRoleTokens(candidate.roles);
    }
    if (candidate.role !== undefined) {
      return normalizeRoleTokens(candidate.role);
    }
  }

  return [];
};

export const normalizeUserRoles = (roleOrRoles: unknown): UserRole[] => {
  const roles = normalizeRoleTokens(roleOrRoles).filter(isValidUserRole);
  if (roles.length === 0) return ["USER"];

  const deduped = Array.from(new Set(roles));
  if (!deduped.includes("USER")) {
    deduped.push("USER");
  }

  return ROLE_PRIORITY.filter((role) => deduped.includes(role));
};

export const getPrimaryRole = (roleOrRoles: unknown): UserRole => normalizeUserRoles(roleOrRoles)[0] ?? "USER";

export const serializeUserRoles = (roleOrRoles: unknown): string => normalizeUserRoles(roleOrRoles).join("|");

export const hasRole = (roleOrRoles: unknown, role: UserRole): boolean => {
  return normalizeUserRoles(roleOrRoles).includes(role);
};

export const isAdminRole = (roleOrRoles: unknown): boolean => hasRole(roleOrRoles, "ADMIN");

export const canAccessArchive = (roleOrRoles: unknown): boolean => {
  return hasRole(roleOrRoles, "ADMIN") || hasRole(roleOrRoles, "ARCHIVIST");
};

export const normalizeUserRole = (roleOrRoles: unknown): UserRole => getPrimaryRole(roleOrRoles);

export const getRoleLabel = (role: UserRole | string) => {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "ARCHIVIST":
      return "Petugas Arsip";
    default:
      return "Pengguna";
  }
};
