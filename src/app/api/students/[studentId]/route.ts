import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  grade: z.string().min(1).optional(),
  teacher: z.string().optional(),
  studentId: z.string().optional(),
  parentEmail: z.string().email().optional().or(z.literal("")),
  familyId: z.string().nullable().optional(),
});

async function verifyStudentAccess(studentId: string, organizationId: string | null) {
  return prisma.student.findFirst({
    where: {
      id: studentId,
      school: { organizationId: organizationId ?? undefined },
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const existing = await verifyStudentAccess(params.studentId, session.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const data = { ...parsed.data };
  if (data.parentEmail === "") data.parentEmail = undefined;

  const student = await prisma.student.update({
    where: { id: params.studentId },
    data,
  });

  return NextResponse.json({ student });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const existing = await verifyStudentAccess(params.studentId, session.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  await prisma.student.delete({ where: { id: params.studentId } });

  return NextResponse.json({ success: true });
}
