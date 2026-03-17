import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const proofLink = await prisma.proofLink.findUnique({
    where: { token: params.token },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, grade: true, familyId: true },
      },
      event: {
        select: { id: true, schoolId: true, school: { select: { name: true } } },
      },
    },
  });

  if (!proofLink) {
    return NextResponse.json({ error: "Proof link not found" }, { status: 404 });
  }

  // Check expiration
  if (proofLink.expiresAt && new Date() > proofLink.expiresAt) {
    return NextResponse.json({ error: "This proof link has expired" }, { status: 410 });
  }

  // Check access code
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (proofLink.accessCode && proofLink.accessCode !== code) {
    return NextResponse.json({
      requiresCode: true,
      schoolName: proofLink.event.school.name,
    });
  }

  // Get photos - either for family or individual
  let studentIds: string[] = [];

  if (proofLink.familyId) {
    const familyMembers = await prisma.student.findMany({
      where: { familyId: proofLink.familyId, schoolId: proofLink.event.schoolId },
      select: { id: true, firstName: true, lastName: true, grade: true },
    });
    studentIds = familyMembers.map((s) => s.id);
  } else if (proofLink.studentId) {
    studentIds = [proofLink.studentId];
  }

  const photos = await prisma.photo.findMany({
    where: {
      eventId: proofLink.eventId,
      studentId: { in: studentIds },
      matched: true,
      isQrSeparator: false,
    },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, grade: true },
      },
    },
    orderBy: [{ studentId: "asc" }, { sequence: "asc" }],
  });

  const storage = getStorage();
  const photosWithUrls = photos.map((p) => ({
    id: p.id,
    url: storage.getUrl(p.storagePath),
    studentId: p.studentId,
    student: p.student,
    sequence: p.sequence,
  }));

  // Group by student
  const studentGroups: Record<string, { student: { firstName: string; lastName: string; grade: string }; photos: typeof photosWithUrls }> = {};
  for (const photo of photosWithUrls) {
    if (!photo.student) continue;
    if (!studentGroups[photo.studentId!]) {
      studentGroups[photo.studentId!] = { student: photo.student, photos: [] };
    }
    studentGroups[photo.studentId!].photos.push(photo);
  }

  // Update view count
  await prisma.proofLink.update({
    where: { id: proofLink.id },
    data: {
      viewCount: { increment: 1 },
      lastViewedAt: new Date(),
    },
  });

  return NextResponse.json({
    schoolName: proofLink.event.school.name,
    eventId: proofLink.eventId,
    studentGroups: Object.values(studentGroups),
    isFamily: !!proofLink.familyId,
  });
}

// POST - select preferred pose
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const proofLink = await prisma.proofLink.findUnique({
    where: { token: params.token },
  });

  if (!proofLink) {
    return NextResponse.json({ error: "Proof link not found" }, { status: 404 });
  }

  if (proofLink.expiresAt && new Date() > proofLink.expiresAt) {
    return NextResponse.json({ error: "This proof link has expired" }, { status: 410 });
  }

  // For now, just acknowledge - pose preference could be stored in a separate table
  return NextResponse.json({ success: true });
}
