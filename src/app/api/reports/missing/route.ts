import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, school: { organizationId: session.organizationId ?? undefined } },
    select: { schoolId: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Get all enrollments for this event (grade/teacher live on enrollment)
  const enrollments = await prisma.enrollment.findMany({
    where: { eventId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          checkIns: {
            where: { eventId },
            select: { status: true },
          },
        },
      },
    },
    orderBy: [{ grade: "asc" }, { student: { lastName: "asc" } }],
  });

  // Filter to students who are absent, pending, or have no check-in
  const missing = enrollments
    .filter((e) => {
      const checkIn = e.student.checkIns[0];
      return !checkIn || checkIn.status === "absent" || checkIn.status === "pending";
    })
    .map((e) => ({
      id: e.student.id,
      firstName: e.student.firstName,
      lastName: e.student.lastName,
      grade: e.grade,
      teacher: e.teacher,
      status: e.student.checkIns[0]?.status || "no check-in",
    }));

  return NextResponse.json({ students: missing });
}
