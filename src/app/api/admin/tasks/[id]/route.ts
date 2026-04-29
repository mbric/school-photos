import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["P1", "P2", "P3"]).optional(),
  assigneeId: z.string().optional(),
  shared: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  complete: z.boolean().optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tasks = prisma.task as any;

const withAssignee = {
  include: { assignee: { select: { id: true, name: true, email: true } } },
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { complete, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (complete === true) data.completedAt = new Date();
  if (complete === false) data.completedAt = null;

  const task = await tasks.update({
    where: { id: params.id },
    data,
    ...withAssignee,
  });

  return NextResponse.json({ task });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await prisma.task.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
