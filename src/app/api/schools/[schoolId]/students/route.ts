import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const studentSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  grade: z.string().min(1, "Grade is required"),
  teacher: z.string().optional(),
  studentId: z.string().optional(),
  parentEmail: z.string().email().optional().or(z.literal("")),
});

async function verifySchoolAccess(schoolId: string, organizationId: string | null) {
  return prisma.school.findFirst({
    where: { id: schoolId, organizationId: organizationId ?? undefined },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const school = await verifySchoolAccess(params.schoolId, session.organizationId);
  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const grade = searchParams.get("grade");
  const teacher = searchParams.get("teacher");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = { schoolId: params.schoolId };
  if (grade) where.grade = grade;
  if (teacher) where.teacher = teacher;
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { studentId: { contains: search } },
    ];
  }

  const students = await prisma.student.findMany({
    where,
    orderBy: [{ grade: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
  });

  // Get unique grades and teachers for filter dropdowns
  const grades = await prisma.student.findMany({
    where: { schoolId: params.schoolId },
    select: { grade: true },
    distinct: ["grade"],
    orderBy: { grade: "asc" },
  });

  const teachers = await prisma.student.findMany({
    where: { schoolId: params.schoolId, teacher: { not: null } },
    select: { teacher: true },
    distinct: ["teacher"],
    orderBy: { teacher: "asc" },
  });

  return NextResponse.json({
    students,
    filters: {
      grades: grades.map((g) => g.grade),
      teachers: teachers.map((t) => t.teacher).filter(Boolean),
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const school = await verifySchoolAccess(params.schoolId, session.organizationId);
  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = studentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const student = await prisma.student.create({
    data: {
      ...parsed.data,
      parentEmail: parsed.data.parentEmail || null,
      schoolId: params.schoolId,
    },
  });

  return NextResponse.json({ student }, { status: 201 });
}
