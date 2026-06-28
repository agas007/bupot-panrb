import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestSessionUser } from "@/lib/session-cookie";

export async function getPph21User(req: NextRequest) {
  const username = getRequestSessionUser(req)?.username ?? req.headers.get("x-simulated-username");
  if (!username) return null;
  return prisma.colleague.findUnique({
    where: { username },
    select: { id: true, username: true, name: true, role: true },
  });
}

export function canManagePph21(user: { id: number; role: string }, record: { assigneeId: number | null }) {
  return user.role === "ADMIN" || record.assigneeId === user.id;
}
