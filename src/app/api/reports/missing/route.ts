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
    where: { id: eventId, photographerId: session.userId },
    select: { schoolId: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Get all students for this school
  const students = await prisma.student.findMany({
    where: { schoolId: event.schoolId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      grade: true,
      teacher: true,
      checkIns: {
        where: { eventId },
        select: { status: true },
      },
    },
    orderBy: [{ grade: "asc" }, { lastName: "asc" }],
  });

  // Filter to students who are absent, pending, or have no check-in
  const missing = students
    .filter((s) => {
      const checkIn = s.checkIns[0];
      return !checkIn || checkIn.status === "absent" || checkIn.status === "pending";
    })
    .map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      grade: s.grade,
      teacher: s.teacher,
      status: s.checkIns[0]?.status || "no check-in",
    }));

  return NextResponse.json({ students: missing });
}
