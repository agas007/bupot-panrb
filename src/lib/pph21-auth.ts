import { NextRequest } from "next/server";
import { isPrismaConnectionError, prisma } from "@/lib/prisma";
import { getRequestSessionUser } from "@/lib/session-cookie";

export async function getPph21User(req: NextRequest) {
  const username = getRequestSessionUser(req)?.username ?? req.headers.get("x-simulated-username");
  if (!username) return null;
  try {
    return await prisma.colleague.findUnique({
      where: { username },
      select: { id: true, username: true, name: true, role: true },
    });
  } catch (error) {
    if (isPrismaConnectionError(error)) {
      console.error("[PPh21 Auth] Database unavailable while loading user session.");
      return null;
    }
    throw error;
  }
}

export function canManagePph21(user: { id: number; role: string }, record: { assigneeId: number | null }) {
  return user.role === "ADMIN" || record.assigneeId === user.id;
}
