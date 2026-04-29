import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).default("TODO"),
  priority: z.enum(["P1", "P2", "P3"]),
  assigneeId: z.string().min(1, "Assignee is required"),
  shared: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

// Prisma v6 generic inference fights `include` + nested select — cast to any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tasks = prisma.task as any;

const withAssignee = {
  include: { assignee: { select: { id: true, name: true, email: true } } },
};

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const completedParam = searchParams.get("completed");

  let where: Record<string, unknown> = {};
  let orderBy: unknown[];
  if (completedParam === "true") {
    where = { completedAt: { not: null } };
    orderBy = [{ completedAt: "desc" }];
  } else {
    where = { completedAt: null };
    orderBy = [{ status: "asc" }, { sortOrder: "asc" }];
  }

  const [taskList, users] = await Promise.all([
    tasks.findMany({ where, orderBy, ...withAssignee }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({ tasks: taskList, users });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { assigneeId, description, ...rest } = parsed.data;
  const task = await tasks.create({
    data: { ...rest, description: description ?? null, assigneeId },
    ...withAssignee,
  });

  return NextResponse.json({ task }, { status: 201 });
}
