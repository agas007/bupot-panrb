import { NextRequest, NextResponse } from "next/server";
import { isPrismaConnectionError, prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createCookieSessionValue, SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from "@/lib/session-cookie";

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
    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: createCookieSessionValue({
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
      }),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    if (isPrismaConnectionError(error)) {
      return NextResponse.json(
        { error: "Database tidak terhubung. Cek DATABASE_URL / Neon server dulu." },
        { status: 503 },
      );
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
