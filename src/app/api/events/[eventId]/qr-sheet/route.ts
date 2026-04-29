import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateStudentQRSvg } from "@/lib/qr";

export async function GET(
  _request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const event = await prisma.event.findFirst({
    where: { id: params.eventId, school: { organizationId: session.organizationId ?? undefined } },
    include: {
      school: {
        select: {
          name: true,
          students: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              grade: true,
              teacher: true,
              studentId: true,
            },
            orderBy: [{ grade: "asc" }, { teacher: "asc" }, { lastName: "asc" }],
          },
        },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // If class order is set, sort students by it
  let students = event.school.students;
  if (event.classOrder) {
    try {
      const order: { grade: string; teacher: string }[] = JSON.parse(event.classOrder);
      const orderIndex = new Map(order.map((o, i) => [`${o.grade}|${o.teacher}`, i]));
      students = [...students].sort((a, b) => {
        const aKey = `${a.grade}|${a.teacher || ""}`;
        const bKey = `${b.grade}|${b.teacher || ""}`;
        const aIdx = orderIndex.get(aKey) ?? 999;
        const bIdx = orderIndex.get(bKey) ?? 999;
        if (aIdx !== bIdx) return aIdx - bIdx;
        return a.lastName.localeCompare(b.lastName);
      });
    } catch {
      // ignore parse errors, use default order
    }
  }

  // Generate QR codes for each student
  const cards: string[] = [];
  for (const student of students) {
    const svg = await generateStudentQRSvg(student.id);
    cards.push(`
      <div class="card">
        <div class="qr">${svg}</div>
        <div class="name">${student.lastName}, ${student.firstName}</div>
        <div class="info">Grade ${student.grade}${student.teacher ? ` — ${student.teacher}` : ""}</div>
        ${student.studentId ? `<div class="sid">${student.studentId}</div>` : ""}
      </div>
    `);
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>QR Sheets — ${event.school.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 10mm; }
    h1 { font-size: 16px; margin-bottom: 4px; }
    .subtitle { font-size: 12px; color: #666; margin-bottom: 16px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .card {
      border: 1px dashed #ccc;
      border-radius: 4px;
      padding: 8px;
      text-align: center;
      page-break-inside: avoid;
    }
    .qr { margin: 0 auto 4px; }
    .qr svg { width: 120px; height: 120px; }
    .name { font-size: 12px; font-weight: 600; }
    .info { font-size: 10px; color: #666; }
    .sid { font-size: 10px; color: #999; font-family: monospace; }
    @media print {
      body { padding: 5mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px;">
    <button onclick="window.print()" style="padding: 8px 16px; font-size: 14px; cursor: pointer;">
      Print QR Sheets
    </button>
  </div>
  <h1>${event.school.name} — QR Sheets</h1>
  <div class="subtitle">${new Date(event.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} &middot; ${students.length} students</div>
  <div class="grid">
    ${cards.join("")}
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
