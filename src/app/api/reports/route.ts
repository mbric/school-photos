import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const schools = await prisma.school.findMany({
    where: { photographerId: session.userId },
    include: {
      events: {
        include: {
          _count: { select: { orders: true, photos: true } },
          checkIns: {
            select: { status: true },
          },
          orders: {
            where: { status: { notIn: ["pending", "awaiting_payment"] } },
            select: { totalAmount: true },
          },
          photos: {
            where: { isQrSeparator: false },
            select: { matched: true },
          },
        },
        orderBy: { date: "desc" },
      },
      _count: { select: { students: true } },
    },
    orderBy: { name: "asc" },
  });

  let totalRevenue = 0;
  let totalOrders = 0;
  let totalEvents = 0;

  const schoolData = schools.map((school) => {
    let schoolRevenue = 0;
    let schoolOrders = 0;

    const events = school.events.map((event) => {
      const revenue = event.orders.reduce((sum, o) => sum + o.totalAmount, 0);
      schoolRevenue += revenue;
      schoolOrders += event._count.orders;

      const photographedCount = event.checkIns.filter((c) => c.status === "photographed").length;
      const absentCount = event.checkIns.filter((c) => c.status === "absent").length;
      const unmatchedPhotos = event.photos.filter((p) => !p.matched).length;

      return {
        eventId: event.id,
        date: event.date.toISOString().split("T")[0],
        type: event.type,
        orderCount: event._count.orders,
        revenue,
        studentCount: school._count.students,
        photographedCount,
        absentCount,
        unmatchedPhotos,
      };
    });

    totalRevenue += schoolRevenue;
    totalOrders += schoolOrders;
    totalEvents += events.length;

    return {
      schoolId: school.id,
      schoolName: school.name,
      events,
      totalRevenue: schoolRevenue,
      totalOrders: schoolOrders,
    };
  });

  return NextResponse.json({
    schools: schoolData,
    totals: {
      revenue: totalRevenue,
      orders: totalOrders,
      schools: schools.length,
      events: totalEvents,
    },
  });
}
