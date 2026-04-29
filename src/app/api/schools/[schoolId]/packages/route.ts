import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const packageSchema = z.object({
  name: z.string().min(1, "Package name is required"),
  description: z.string().optional(),
  price: z.number().int().min(0, "Price must be non-negative"),
  contents: z.string().min(1, "Contents are required"), // JSON string
  digital: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

async function verifySchoolAccess(schoolId: string, organizationId: string | null) {
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

  const school = await verifySchoolAccess(params.schoolId, session.organizationId);
  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const packages = await prisma.package.findMany({
    where: { schoolId: params.schoolId },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ packages });
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
  const parsed = packageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const pkg = await prisma.package.create({
    data: {
      ...parsed.data,
      schoolId: params.schoolId,
    },
  });

  return NextResponse.json({ package: pkg }, { status: 201 });
}
