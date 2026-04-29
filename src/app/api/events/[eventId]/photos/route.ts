import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import { autoMatchPhotos } from "@/lib/matching";

async function verifyEventAccess(eventId: string, organizationId: string | null) {
  return prisma.event.findFirst({
    where: { id: eventId, school: { organizationId: organizationId ?? undefined } },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const event = await verifyEventAccess(params.eventId, session.organizationId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter"); // matched | unmatched | flagged | all

  const includeQr = searchParams.get("includeQr") === "true";

  const where: Record<string, unknown> = { eventId: params.eventId };
  if (!includeQr) where.isQrSeparator = false;
  if (filter === "matched") where.matched = true;
  if (filter === "unmatched") where.matched = false;
  if (filter === "flagged") where.flagged = true;

  const photos = await prisma.photo.findMany({
    where,
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          grade: true,
          teacher: true,
          studentId: true,
        },
      },
    },
    orderBy: { sequence: "asc" },
  });

  const storage = getStorage();
  const photosWithUrls = photos.map((p) => ({
    ...p,
    url: storage.getUrl(p.storagePath),
    thumbnailUrl: p.thumbnailPath ? storage.getUrl(p.thumbnailPath) : null,
  }));

  // Stats (exclude QR separators)
  const statsWhere = { eventId: params.eventId, isQrSeparator: false };
  const totalPhotos = await prisma.photo.count({ where: statsWhere });
  const matchedCount = await prisma.photo.count({ where: { ...statsWhere, matched: true } });
  const unmatchedCount = await prisma.photo.count({ where: { ...statsWhere, matched: false } });
  const flaggedCount = await prisma.photo.count({ where: { ...statsWhere, flagged: true } });

  // Get students for this school (for manual assignment dropdown)
  const eventData = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: { schoolId: true },
  });
  const students = await prisma.student.findMany({
    where: { schoolId: eventData!.schoolId },
    select: { id: true, firstName: true, lastName: true, grade: true, studentId: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json({
    photos: photosWithUrls,
    stats: { total: totalPhotos, matched: matchedCount, unmatched: unmatchedCount, flagged: flaggedCount },
    students,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const event = await verifyEventAccess(params.eventId, session.organizationId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const files = formData.getAll("photos") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  const storage = getStorage();

  // Get current max sequence
  const maxSeq = await prisma.photo.aggregate({
    where: { eventId: params.eventId },
    _max: { sequence: true },
  });
  let seq = (maxSeq._max.sequence || 0) + 1;

  const uploaded = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { storagePath } = await storage.upload(buffer, file.name, params.eventId);

    const photo = await prisma.photo.create({
      data: {
        filename: file.name,
        storagePath,
        mimeType: file.type || "image/jpeg",
        fileSize: buffer.length,
        sequence: seq++,
        eventId: params.eventId,
      },
    });

    uploaded.push(photo);
  }

  return NextResponse.json({ uploaded: uploaded.length }, { status: 201 });
}
