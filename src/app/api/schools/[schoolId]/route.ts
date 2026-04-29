import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  paymentInstructions: z.string().optional(),
});

async function getSchoolForSession(schoolId: string, organizationId: string | null) {
  return prisma.school.findFirst({
    where: { id: schoolId, organizationId: organizationId ?? undefined },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const school = await prisma.school.findFirst({
    where: { id: params.schoolId, organizationId: session.organizationId ?? undefined },
    include: {
      _count: { select: { students: true, events: true } },
    },
  });

  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  return NextResponse.json({ school });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const existing = await getSchoolForSession(params.schoolId, session.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const school = await prisma.school.update({
    where: { id: params.schoolId },
    data: {
      ...parsed.data,
      contactEmail: parsed.data.contactEmail || null,
    },
  });

  return NextResponse.json({ school });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const existing = await getSchoolForSession(params.schoolId, session.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  await prisma.school.delete({ where: { id: params.schoolId } });

  return NextResponse.json({ success: true });
}
