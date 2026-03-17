import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const schoolSchema = z.object({
  name: z.string().min(1, "School name is required"),
  address: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const schools = await prisma.school.findMany({
    where: { photographerId: session.userId },
    include: {
      _count: { select: { students: true, events: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ schools });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schoolSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const school = await prisma.school.create({
    data: {
      ...parsed.data,
      contactEmail: parsed.data.contactEmail || null,
      photographerId: session.userId,
    },
  });

  return NextResponse.json({ school }, { status: 201 });
}
