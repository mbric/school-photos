import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateProofToken, generateAccessCode } from "@/lib/tokens";

const generateSchema = z.object({
  action: z.enum(["generate-all", "generate-single"]),
  studentId: z.string().optional(),
  useAccessCode: z.boolean().default(false),
  expiresInDays: z.number().default(30),
  groupByFamily: z.boolean().default(true),
});

async function verifyEventAccess(eventId: string, organizationId: string | null) {
  return prisma.event.findFirst({
    where: { id: eventId, school: { organizationId: organizationId ?? undefined } },
  });
}

export async function GET(
  _request: NextRequest,
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

  const proofLinks = await prisma.proofLink.findMany({
    where: { eventId: params.eventId },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, parentEmail: true, familyId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Count students with matched photos (eligible for proofs)
  const eventData = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: { schoolId: true },
  });
  const studentsWithPhotos = await prisma.student.findMany({
    where: {
      schoolId: eventData!.schoolId,
      photos: { some: { eventId: params.eventId, matched: true } },
    },
    select: { id: true, firstName: true, lastName: true, parentEmail: true, familyId: true },
  });

  return NextResponse.json({
    proofLinks,
    studentsWithPhotos,
    stats: {
      totalLinks: proofLinks.length,
      emailsSent: proofLinks.filter((p) => p.emailSentAt).length,
      totalViews: proofLinks.reduce((sum, p) => sum + p.viewCount, 0),
    },
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

  const body = await request.json();
  const parsed = generateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { action, useAccessCode, expiresInDays, groupByFamily } = parsed.data;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  if (action === "generate-single" && parsed.data.studentId) {
    const token = generateProofToken();
    const proofLink = await prisma.proofLink.create({
      data: {
        token,
        accessCode: useAccessCode ? generateAccessCode() : null,
        expiresAt,
        eventId: params.eventId,
        studentId: parsed.data.studentId,
      },
    });
    return NextResponse.json({ created: 1, proofLinks: [proofLink] }, { status: 201 });
  }

  if (action === "generate-all") {
    // Get all students with matched photos for this event
    const eventData = await prisma.event.findUnique({
      where: { id: params.eventId },
      select: { schoolId: true },
    });

    const students = await prisma.student.findMany({
      where: {
        schoolId: eventData!.schoolId,
        photos: { some: { eventId: params.eventId, matched: true } },
      },
    });

    // Delete existing proof links for this event
    await prisma.proofLink.deleteMany({ where: { eventId: params.eventId } });

    const created: Array<{ token: string; studentId: string | null; familyId: string | null }> = [];

    if (groupByFamily) {
      // Group students by family
      const families = new Map<string, typeof students>();
      const singles: typeof students = [];

      for (const s of students) {
        if (s.familyId) {
          if (!families.has(s.familyId)) families.set(s.familyId, []);
          families.get(s.familyId)!.push(s);
        } else {
          singles.push(s);
        }
      }

      // Create one link per family
      for (const [familyId, members] of Array.from(families.entries())) {
        const token = generateProofToken();
        await prisma.proofLink.create({
          data: {
            token,
            accessCode: useAccessCode ? generateAccessCode() : null,
            familyId,
            expiresAt,
            eventId: params.eventId,
            studentId: members[0].id, // primary student
          },
        });
        created.push({ token, studentId: members[0].id, familyId });
      }

      // Create one link per individual student
      for (const s of singles) {
        const token = generateProofToken();
        await prisma.proofLink.create({
          data: {
            token,
            accessCode: useAccessCode ? generateAccessCode() : null,
            expiresAt,
            eventId: params.eventId,
            studentId: s.id,
          },
        });
        created.push({ token, studentId: s.id, familyId: null });
      }
    } else {
      // One link per student
      for (const s of students) {
        const token = generateProofToken();
        await prisma.proofLink.create({
          data: {
            token,
            accessCode: useAccessCode ? generateAccessCode() : null,
            expiresAt,
            eventId: params.eventId,
            studentId: s.id,
          },
        });
        created.push({ token, studentId: s.id, familyId: null });
      }
    }

    return NextResponse.json({ created: created.length }, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
