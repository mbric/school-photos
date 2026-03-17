import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const event = await prisma.event.findFirst({
    where: { id: params.eventId, photographerId: session.userId },
    include: { school: { select: { name: true } } },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const orders = await prisma.order.findMany({
    where: {
      eventId: params.eventId,
      status: { not: "pending" },
    },
    include: {
      items: {
        include: {
          package: { select: { name: true, contents: true } },
          student: {
            select: { firstName: true, lastName: true, grade: true, teacher: true },
          },
          photo: { select: { filename: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Build CSV
  const rows: string[] = [
    "Order Number,Status,Student Last Name,Student First Name,Grade,Teacher,Package,Photo Filename,Quantity,Unit Price,Total,Parent Name,Parent Email,Order Date",
  ];

  for (const order of orders) {
    for (const item of order.items) {
      rows.push(
        [
          order.orderNumber,
          order.status,
          item.student.lastName,
          item.student.firstName,
          item.student.grade,
          item.student.teacher || "",
          item.package.name,
          item.photo?.filename || "",
          item.quantity,
          (item.unitPrice / 100).toFixed(2),
          ((item.unitPrice * item.quantity) / 100).toFixed(2),
          order.parentName || "",
          order.parentEmail || "",
          order.createdAt.toISOString().split("T")[0],
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
    }
  }

  const csv = rows.join("\n");
  const filename = `orders-${event.school.name.replace(/[^a-zA-Z0-9]/g, "-")}-${event.date.toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
