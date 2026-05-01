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
});

export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const school = await prisma.school.findFirst({
    where: { id: params.schoolId, organizationId: session.organizationId ?? undefined },
  });
  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = importSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid import data", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { students } = parsed.data;

  // Validate and collect errors
  const errors: { row: number; message: string }[] = [];
  const valid: typeof students = [];

  // Check for duplicate student IDs within the import
  const seenIds = new Set<string>();

  for (let i = 0; i < students.length; i++) {
    const s = students[i];

    if (!s.firstName || !s.lastName) {
      errors.push({ row: i + 1, message: "Missing first or last name" });
      continue;
    }

    if (s.studentId) {
      if (seenIds.has(s.studentId)) {
        errors.push({ row: i + 1, message: `Duplicate student ID: ${s.studentId}` });
        continue;
      }
      seenIds.add(s.studentId);

      // Check for existing student ID in this school
      const existing = await prisma.student.findFirst({
        where: { schoolId: params.schoolId, studentId: s.studentId },
      });
      if (existing) {
        errors.push({
          row: i + 1,
          message: `Student ID ${s.studentId} already exists (${existing.firstName} ${existing.lastName})`,
        });
        continue;
      }
    }

    valid.push(s);
  }

  // Bulk create valid students
  let created = 0;
  if (valid.length > 0) {
    const result = await prisma.student.createMany({
      data: valid.map((s) => ({
        firstName: s.firstName,
        lastName: s.lastName,
        studentId: s.studentId || null,
        parentEmail: s.parentEmail || null,
        schoolId: params.schoolId,
      })),
    });
    created = result.count;
  }

  return NextResponse.json({
    created,
    errors,
    total: students.length,
  });
}
