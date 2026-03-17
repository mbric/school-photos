import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { randomBytes } from "crypto";

async function verifySchoolAccess(schoolId: string, userId: string) {
  return prisma.school.findFirst({
    where: { id: schoolId, photographerId: userId },
  });
}

// Auto-link siblings by matching parent email
export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const school = await verifySchoolAccess(params.schoolId, session.userId);
  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === "auto-link") {
    // Group by parent email
    const students = await prisma.student.findMany({
      where: {
        schoolId: params.schoolId,
        parentEmail: { not: null },
      },
      orderBy: [{ parentEmail: "asc" }, { lastName: "asc" }],
    });

    const emailGroups = new Map<string, typeof students>();
    for (const s of students) {
      if (!s.parentEmail) continue;
      const key = s.parentEmail.toLowerCase();
      if (!emailGroups.has(key)) emailGroups.set(key, []);
      emailGroups.get(key)!.push(s);
    }

    let familiesLinked = 0;
    let studentsLinked = 0;

    for (const [, group] of Array.from(emailGroups.entries())) {
      if (group.length < 2) continue;

      // Use existing familyId from any member, or create a new one
      const existingFamilyId = group.find((s) => s.familyId)?.familyId;
      const familyId = existingFamilyId || `fam-${randomBytes(6).toString("hex")}`;

      for (const student of group) {
        if (student.familyId !== familyId) {
          await prisma.student.update({
            where: { id: student.id },
            data: { familyId },
          });
          studentsLinked++;
        }
      }
      familiesLinked++;
    }

    return NextResponse.json({ familiesLinked, studentsLinked });
  }

  if (action === "manual-link") {
    const { studentIds } = body;
    if (!Array.isArray(studentIds) || studentIds.length < 2) {
      return NextResponse.json({ error: "Need at least 2 students" }, { status: 400 });
    }

    const familyId = `fam-${randomBytes(6).toString("hex")}`;
    await prisma.student.updateMany({
      where: { id: { in: studentIds }, schoolId: params.schoolId },
      data: { familyId },
    });

    return NextResponse.json({ familyId, linked: studentIds.length });
  }

  if (action === "unlink") {
    const { studentId } = body;
    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 });
    }

    await prisma.student.update({
      where: { id: studentId },
      data: { familyId: null },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
