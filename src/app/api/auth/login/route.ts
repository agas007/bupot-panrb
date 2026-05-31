import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const isBcryptHash = (password: string) => /^\$2[aby]\$\d{2}\$/.test(password);

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json() as {
      username?: string;
      password?: string;
    };
    const loginUsername = typeof username === "string" ? username.trim() : "";
    const loginPassword = typeof password === "string" ? password : "";

    const user = await prisma.colleague.findUnique({
      where: { username: loginUsername }
    });

    const isValidPassword = Boolean(user && loginPassword && (
      isBcryptHash(user.password)
        ? await bcrypt.compare(loginPassword, user.password)
        : user.password === loginPassword
    ));

    if (!user || !isValidPassword) {
      // Audit Log for failed attempt
      await prisma.auditLog.create({
        data: {
          userName: loginUsername || "Unknown",
          action: "Failed Login Attempt",
          target: "System Portal",
          type: "danger",
        }
      });
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    // Audit Log for successful login
    await prisma.auditLog.create({
      data: {
        userName: user.username,
        action: "Logged In",
        target: "Dashboard",
        type: "user",
      }
    });

    // Return user without password
    return NextResponse.json({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
