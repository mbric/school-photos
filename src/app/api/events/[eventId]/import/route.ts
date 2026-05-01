import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const importSchema = z.object({
  students: z.array(
    z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      grade: z.string().min(1),
      teacher: z.string().optional(),
      studentId: z.string().optional(),
      parentEmail: z.string().optional(),
    })
  ),
  confirm: z.boolean().default(false),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const event = await prisma.event.findFirst({
    where: {
      id: params.eventId,
      school: { organizationId: session.organizationId ?? undefined },
    },
    select: { id: true, schoolId: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = await request.json();

  // Handle bulk import from school roster (no CSV needed)
  if (body.action === "from-school") {
    const allStudents = await prisma.student.findMany({
      where: { schoolId: event.schoolId },
      select: { id: true },
    });

    const existing = await db.enrollment.findMany({
      where: { eventId: params.eventId },
      select: { studentId: true },
    });
    const enrolledIds = new Set(existing.map((e: any) => e.studentId));
    const toEnroll = allStudents.filter((s) => !enrolledIds.has(s.id));

    if (toEnroll.length > 0) {
      await db.enrollment.createMany({
        data: toEnroll.map((s) => ({
          studentId: s.id,
          eventId: params.eventId,
          grade: "",
          teacher: null,
        })),
      });
    }

    return NextResponse.json({
      enrolled: toEnroll.length,
      alreadyEnrolled: enrolledIds.size,
      total: allStudents.length,
    });
  }

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid import data" }, { status: 400 });
  }

  const { students, confirm } = parsed.data;

  // Warn if check-ins already exist and the caller hasn't confirmed
  if (!confirm) {
    const checkInCount = await prisma.checkIn.count({
      where: { eventId: params.eventId },
    });
    if (checkInCount > 0) {
      return NextResponse.json(
        {
          warning: true,
          checkInCount,
          message: `This event has ${checkInCount} check-in${checkInCount === 1 ? "" : "s"}. Importing will update student assignments but won't affect existing check-ins. Send { confirm: true } to proceed.`,
        },
        { status: 409 }
      );
    }
  }

  const errors: { row: number; message: string }[] = [];
  let created = 0;
  let updated = 0;
  let enrolled = 0;

  for (let i = 0; i < students.length; i++) {
    const s = students[i];

    try {
      // 1. Upsert master student record (identity + contact info only)
      let student: { id: string } | null = null;

      if (s.studentId) {
        // Match by student ID within this school
        student = await db.student.upsert({
          where: { studentId_schoolId: { studentId: s.studentId, schoolId: event.schoolId } },
          create: {
            firstName: s.firstName,
            lastName: s.lastName,
            studentId: s.studentId,
            parentEmail: s.parentEmail || null,
            schoolId: event.schoolId,
          },
          update: {
            firstName: s.firstName,
            lastName: s.lastName,
            parentEmail: s.parentEmail || null,
          },
          select: { id: true },
        });
      } else {
        // Match by name within this school
        const existing = await prisma.student.findFirst({
          where: {
            schoolId: event.schoolId,
            firstName: s.firstName,
            lastName: s.lastName,
          },
          select: { id: true },
        });

        if (existing) {
          await prisma.student.update({
            where: { id: existing.id },
            data: { parentEmail: s.parentEmail || undefined },
          });
          student = existing;
          updated++;
        } else {
          student = await prisma.student.create({
            data: {
              firstName: s.firstName,
              lastName: s.lastName,
              parentEmail: s.parentEmail || null,
              schoolId: event.schoolId,
            },
            select: { id: true },
          });
          created++;
        }
      }

      // 2. Upsert enrollment (grade/teacher for this specific event)
      if (!student) throw new Error("Student record not found after upsert");
      await db.enrollment.upsert({
        where: { studentId_eventId: { studentId: student.id, eventId: params.eventId } },
        create: {
          studentId: student.id,
          eventId: params.eventId,
          grade: s.grade,
          teacher: s.teacher || null,
        },
        update: {
          grade: s.grade,
          teacher: s.teacher || null,
        },
      });
      enrolled++;
    } catch {
      errors.push({ row: i + 1, message: `Failed to import ${s.firstName} ${s.lastName}` });
    }
  }

  return NextResponse.json({
    created,
    updated,
    enrolled,
    errors,
    total: students.length,
  });
}
