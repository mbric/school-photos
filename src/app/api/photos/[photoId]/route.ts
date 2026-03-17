import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const updateSchema = z.object({
  studentId: z.string().nullable().optional(),
  matched: z.boolean().optional(),
  flagged: z.boolean().optional(),
  flagReason: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { photoId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Verify ownership through event
  const photo = await prisma.photo.findFirst({
    where: { id: params.photoId },
    include: { event: { select: { photographerId: true } } },
  });

  if (!photo || photo.event.photographerId !== session.userId) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.studentId !== undefined) {
    data.studentId = parsed.data.studentId;
    data.matched = parsed.data.studentId !== null;
  }
  if (parsed.data.matched !== undefined) data.matched = parsed.data.matched;
  if (parsed.data.flagged !== undefined) data.flagged = parsed.data.flagged;
  if (parsed.data.flagReason !== undefined) data.flagReason = parsed.data.flagReason || null;

  const updated = await prisma.photo.update({
    where: { id: params.photoId },
    data,
  });

  return NextResponse.json({ photo: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { photoId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const photo = await prisma.photo.findFirst({
    where: { id: params.photoId },
    include: { event: { select: { photographerId: true } } },
  });

  if (!photo || photo.event.photographerId !== session.userId) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  await prisma.photo.delete({ where: { id: params.photoId } });
  return NextResponse.json({ success: true });
}
