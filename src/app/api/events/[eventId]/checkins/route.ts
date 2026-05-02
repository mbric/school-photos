import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const checkinSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["pending", "photographed", "absent", "retake"]),
  notes: z.string().optional(),
});

const bulkInitSchema = z.object({
  action: z.literal("init"),
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

  const checkIns = await prisma.checkIn.findMany({
    where: { eventId: params.eventId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentId: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Get all enrolled students for this event
  const enrollments = await prisma.enrollment.findMany({
    where: { eventId: params.eventId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentId: true,
        },
      },
    },
    orderBy: [{ grade: "asc" }, { student: { lastName: "asc" } }],
  });

  const allStudents = enrollments.map((e) => ({
    ...e.student,
    grade: e.grade,
    teacher: e.teacher,
  }));

  // Compute progress stats
  const statusCounts = { pending: 0, photographed: 0, absent: 0, retake: 0 };
  for (const ci of checkIns) {
    statusCounts[ci.status as keyof typeof statusCounts]++;
  }

  // Get next sequence number
  const maxSeq = await prisma.checkIn.aggregate({
    where: { eventId: params.eventId },
    _max: { sequence: true },
  });

  const logs = await prisma.checkInLog.findMany({
    where: { eventId: params.eventId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentId: true,
        },
      },
    },
    orderBy: { timestamp: "asc" },
  });

  return NextResponse.json({
    checkIns,
    allStudents,
    logs,
    stats: {
      total: allStudents.length,
      ...statusCounts,
      done: statusCounts.photographed,
      remaining: allStudents.length - statusCounts.photographed - statusCounts.absent,
    },
    nextSequence: (maxSeq._max.sequence || 0) + 1,
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

  // Handle bulk init - create pending check-ins for all enrolled students
  const bulkParsed = bulkInitSchema.safeParse(body);
  if (bulkParsed.success) {
    const enrollments = await prisma.enrollment.findMany({
      where: { eventId: params.eventId },
      select: { studentId: true },
    });
    const students: { id: string }[] = enrollments.map((e) => ({ id: e.studentId }));

    const existing = await prisma.checkIn.findMany({
      where: { eventId: params.eventId },
      select: { studentId: true },
    });
    const existingIds = new Set(existing.map((c) => c.studentId));

    const toCreate = students.filter((s) => !existingIds.has(s.id));

    if (toCreate.length > 0) {
      await prisma.checkIn.createMany({
        data: toCreate.map((s) => ({
          studentId: s.id,
          eventId: params.eventId,
          status: "pending",
        })),
      });
    }

    // Mark event as in_progress
    await prisma.event.update({
      where: { id: params.eventId },
      data: { status: "in_progress" },
    });

    return NextResponse.json({ initialized: toCreate.length });
  }

  // Handle single check-in update
  const parsed = checkinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { studentId, status, notes } = parsed.data;

  // Get next sequence number for photographed status
  let sequence: number | null = null;
  if (status === "photographed") {
    const maxSeq = await prisma.checkIn.aggregate({
      where: { eventId: params.eventId },
      _max: { sequence: true },
    });
    sequence = (maxSeq._max.sequence || 0) + 1;
  }

  const checkIn = await prisma.checkIn.upsert({
    where: {
      studentId_eventId: { studentId, eventId: params.eventId },
    },
    create: {
      studentId,
      eventId: params.eventId,
      status,
      sequence,
      notes: notes || null,
      checkedInAt: status === "photographed" ? new Date() : null,
    },
    update: {
      status,
      sequence: status === "photographed" ? sequence : undefined,
      notes: notes !== undefined ? notes || null : undefined,
      checkedInAt: status === "photographed" ? new Date() : undefined,
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentId: true,
        },
      },
    },
  });

  // Log meaningful status changes (skip initial "pending" creation from walk-ups)
  // A "pending" status is only meaningful if the student had prior log entries (i.e., it's a reset)
  let shouldLog = status !== "pending";
  if (status === "pending") {
    const priorLogs = await prisma.checkInLog.count({
      where: { checkInId: checkIn.id },
    });
    shouldLog = priorLogs > 0;
  }

  if (shouldLog) {
    await prisma.checkInLog.create({
      data: {
        checkInId: checkIn.id,
        studentId,
        eventId: params.eventId,
        action: status,
        sequence: status === "photographed" ? sequence : null,
      },
    });
  }

  return NextResponse.json({ checkIn });
}

export async function DELETE(
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

  // Delete logs first (FK constraint), then check-ins, then reset status
  await prisma.checkInLog.deleteMany({ where: { eventId: params.eventId } });
  await prisma.checkIn.deleteMany({ where: { eventId: params.eventId } });
  await prisma.event.update({
    where: { id: params.eventId },
    data: { status: "scheduled" },
  });

  return NextResponse.json({ success: true });
}
