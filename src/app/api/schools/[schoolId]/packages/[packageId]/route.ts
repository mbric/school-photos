import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().int().min(0).optional(),
  contents: z.string().optional(),
  digital: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

async function verifyPackageAccess(schoolId: string, packageId: string, userId: string) {
  const school = await prisma.school.findFirst({
    where: { id: schoolId, photographerId: userId },
  });
  if (!school) return null;

  return prisma.package.findFirst({
    where: { id: packageId, schoolId },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { schoolId: string; packageId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const pkg = await verifyPackageAccess(params.schoolId, params.packageId, session.userId);
  if (!pkg) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  return NextResponse.json({ package: pkg });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { schoolId: string; packageId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const existing = await verifyPackageAccess(params.schoolId, params.packageId, session.userId);
  if (!existing) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const pkg = await prisma.package.update({
    where: { id: params.packageId },
    data: parsed.data,
  });

  return NextResponse.json({ package: pkg });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { schoolId: string; packageId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const existing = await verifyPackageAccess(params.schoolId, params.packageId, session.userId);
  if (!existing) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  // Check if any orders reference this package
  const orderCount = await prisma.orderItem.count({
    where: { packageId: params.packageId },
  });

  if (orderCount > 0) {
    // Soft-delete by deactivating instead
    await prisma.package.update({
      where: { id: params.packageId },
      data: { active: false },
    });
    return NextResponse.json({ deactivated: true });
  }

  await prisma.package.delete({ where: { id: params.packageId } });
  return NextResponse.json({ success: true });
}
