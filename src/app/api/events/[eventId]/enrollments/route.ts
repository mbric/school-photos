import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const upsertSchema = z.object({
  studentId: z.string().min(1),
  grade: z.string(),
  teacher: z.string().optional(),
});

const createSchema = z.object({
  action: z.literal("create"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  studentId: z.string().optional(),
});

const removeSchema = z.object({
  studentId: z.string().min(1),
  confirm: z.boolean().default(false),
});

async function verifyEventAccess(eventId: string, organizationId: string | null) {
  return prisma.event.findFirst({
    where: { id: eventId, school: { organizationId: organizationId ?? undefined } },
  });
}

// Search school students for adding — returns unenrolled matches and already-enrolled matches separately
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const event = await verifyEventAccess(params.eventId, session.organizationId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";

  if (search.length < 1) return NextResponse.json({ students: [], alreadyEnrolled: [] });

  const enrolled = await prisma.enrollment.findMany({
    where: { eventId: params.eventId },
    select: { studentId: true },
  });
  const enrolledIds = new Set(enrolled.map((e) => e.studentId));

  const students = await prisma.student.findMany({
    where: {
      schoolId: event.schoolId,
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { studentId: { contains: search } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, studentId: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 10,
  });

  return NextResponse.json({
    students: students.filter((s) => !enrolledIds.has(s.id)),
    alreadyEnrolled: students.filter((s) => enrolledIds.has(s.id)),
  });
}

// Enroll an existing student (upsert grade/teacher) OR create a new student and enroll them
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const event = await verifyEventAccess(params.eventId, session.organizationId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const body = await request.json();

  // Create new student + enroll
  if (body.action === "create") {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { firstName, lastName, studentId: sId } = parsed.data;

    // Check for existing student — by studentId first, then by name
    let existing = sId
      ? await prisma.student.findFirst({
          where: { schoolId: event.schoolId, studentId: sId },
          select: { id: true, firstName: true, lastName: true, studentId: true },
        })
      : null;
    if (!existing) {
      existing = await prisma.student.findFirst({
        where: { schoolId: event.schoolId, firstName, lastName },
        select: { id: true, firstName: true, lastName: true, studentId: true },
      });
    }

    if (existing) {
      const alreadyEnrolled = await prisma.enrollment.findFirst({
        where: { studentId: existing.id, eventId: params.eventId },
      });
      if (alreadyEnrolled) {
        return NextResponse.json({
          error: `${existing.firstName} ${existing.lastName} is already enrolled in this event.`,
          alreadyEnrolled: true,
          existingStudent: existing,
        }, { status: 409 });
      }
      // Student exists in school but not enrolled — surface to client to offer enrollment
      return NextResponse.json({
        exists: true,
        message: `A student named ${existing.firstName} ${existing.lastName} already exists in this school's roster.`,
        existingStudent: existing,
      }, { status: 409 });
    }

    const student = await prisma.student.create({
      data: { firstName, lastName, studentId: sId || null, schoolId: event.schoolId },
      select: { id: true, firstName: true, lastName: true, studentId: true },
    });
    await prisma.enrollment.create({
      data: { studentId: student.id, eventId: params.eventId, grade: "", teacher: null },
    });
    return NextResponse.json({ student, enrolled: true }, { status: 201 });
  }

  // Enroll existing student (or update their grade/teacher)
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.upsert({
    where: { studentId_eventId: { studentId: parsed.data.studentId, eventId: params.eventId } },
    create: {
      studentId: parsed.data.studentId,
      eventId: params.eventId,
      grade: parsed.data.grade,
      teacher: parsed.data.teacher || null,
    },
    update: {
      grade: parsed.data.grade,
      teacher: parsed.data.teacher || null,
    },
  });

  return NextResponse.json({ enrollment });
}

// Remove a student from this event's enrollment.
// Blocks if they have orders. Warns if they have check-in/photo data (requires confirm: true to proceed).
// Never deletes the student from the school — enrollment only.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const event = await verifyEventAccess(params.eventId, session.organizationId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const body = await request.json();
  const parsed = removeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { studentId, confirm } = parsed.data;

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, eventId: params.eventId },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Student is not enrolled in this event" }, { status: 404 });
  }

  // Hard block — cannot remove a student who has placed orders
  const orderCount = await prisma.orderItem.count({
    where: { studentId, order: { eventId: params.eventId } },
  });
  if (orderCount > 0) {
    return NextResponse.json({
      error: `Cannot remove — this student has ${orderCount} order${orderCount !== 1 ? "s" : ""} for this event.`,
      hasOrders: true,
    }, { status: 409 });
  }

  // Soft warn — check-in record or matched photos exist
  const checkIn = await prisma.checkIn.findFirst({ where: { studentId, eventId: params.eventId } });
  const photoCount = await prisma.photo.count({ where: { eventId: params.eventId, studentId } });

  if (!confirm && (checkIn || photoCount > 0)) {
    const parts: string[] = [];
    if (checkIn) parts.push(`checked in (${checkIn.status})`);
    if (photoCount > 0) parts.push(`${photoCount} photo${photoCount !== 1 ? "s" : ""} matched`);
    return NextResponse.json({
      warning: true,
      message: `This student is ${parts.join(" and ")}. Removing will delete their check-in record and unlink matched photos.`,
    }, { status: 409 });
  }

  // Delete check-in logs and check-in record
  if (checkIn) {
    await prisma.checkInLog.deleteMany({ where: { checkInId: checkIn.id } });
    await prisma.checkIn.delete({ where: { id: checkIn.id } });
  }

  // Unlink matched photos (keep the photos, just remove the student assignment)
  if (photoCount > 0) {
    await prisma.photo.updateMany({
      where: { eventId: params.eventId, studentId },
      data: { studentId: null, matched: false },
    });
  }

  await prisma.enrollment.delete({
    where: { studentId_eventId: { studentId, eventId: params.eventId } },
  });

  return NextResponse.json({ success: true });
}
