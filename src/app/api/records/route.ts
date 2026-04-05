import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const assigneeId = searchParams.get("assigneeId");
  const status = searchParams.get("status");

  try {
    const records = await prisma.sPMRecord.findMany({
      where: {
        ...(assigneeId ? { assigneeId: Number(assigneeId) } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        assignee: true,
      },
      orderBy: {
        sp2dDate: "desc",
      },
    });

    return NextResponse.json(records);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, docLink, notes, assigneeId } = body;

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === "COMPLETED") {
        updateData.completionDate = new Date();
      }
    }
    if (docLink !== undefined) updateData.docLink = docLink;
    if (notes !== undefined) updateData.notes = notes;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;

    const record = await prisma.sPMRecord.update({
      where: { id: Number(id) },
      data: updateData,
    });

    return NextResponse.json(record);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
