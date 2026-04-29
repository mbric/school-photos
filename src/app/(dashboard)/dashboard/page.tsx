import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar,
  School,
  ShoppingCart,
  Camera,
  AlertTriangle,
  DollarSign,
  Clock,
  Users,
} from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const now = new Date();

  const [
    schoolCount,
    upcomingEvents,
    recentOrders,
    pendingOrderCount,
    awaitingPaymentCount,
    unmatchedPhotoCount,
    totalRevenue,
  ] = await Promise.all([
    prisma.school.count({ where: { organizationId: user.organizationId ?? undefined } }),
    prisma.event.findMany({
      where: { school: { organizationId: user.organizationId ?? undefined }, date: { gte: now } },
      include: { school: { select: { name: true } } },
      orderBy: { date: "asc" },
      take: 5,
    }),
    prisma.order.findMany({
      where: { event: { school: { organizationId: user.organizationId ?? undefined } } },
      include: {
        event: { select: { school: { select: { name: true } } } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.order.count({
      where: { event: { school: { organizationId: user.organizationId ?? undefined } }, status: "pending" },
    }),
    prisma.order.count({
      where: { event: { school: { organizationId: user.organizationId ?? undefined } }, status: "awaiting_payment" },
    }),
    prisma.photo.count({
      where: { event: { school: { organizationId: user.organizationId ?? undefined } }, matched: false, isQrSeparator: false },
    }),
    prisma.order.aggregate({
      where: {
        event: { school: { organizationId: user.organizationId ?? undefined } },
        status: { notIn: ["pending", "awaiting_payment"] },
      },
      _sum: { totalAmount: true },
    }),
  ]);

  const revenue = totalRevenue._sum.totalAmount || 0;

  const alerts: { message: string; href: string; type: "warning" | "info" }[] = [];
  if (unmatchedPhotoCount > 0) {
    alerts.push({
      message: `${unmatchedPhotoCount} unmatched photo${unmatchedPhotoCount === 1 ? "" : "s"} need review`,
      href: "/dashboard/events",
      type: "warning",
    });
  }
  if (awaitingPaymentCount > 0) {
    alerts.push({
      message: `${awaitingPaymentCount} order${awaitingPaymentCount === 1 ? "" : "s"} awaiting payment confirmation`,
      href: "/dashboard/orders?status=awaiting_payment",
      type: "info",
    });
  }

  function formatCents(cents: number) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatDate(date: Date) {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }

  function formatRelativeDate(date: Date) {
    const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff <= 7) return `In ${diff} days`;
    return formatDate(date);
  }

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    awaiting_payment: "bg-yellow-100 text-yellow-700",
    paid: "bg-green-100 text-green-700",
    sent_to_lab: "bg-blue-100 text-blue-700",
    printed: "bg-purple-100 text-purple-700",
    delivered: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">
        Welcome back, {user.name?.split(" ")[0]}
      </h1>
      <p className="text-muted-foreground mb-6">
        Here&apos;s an overview of your photography business.
      </p>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2 mb-6">
          {alerts.map((alert, i) => (
            <Link key={i} href={alert.href}>
              <div
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${
                  alert.type === "warning"
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-blue-50 text-blue-800 border border-blue-200"
                }`}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {alert.message}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Schools</span>
              <School className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold">{schoolCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Upcoming Events</span>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold">{upcomingEvents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Pending Orders</span>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold">{pendingOrderCount + awaitingPaymentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Revenue</span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold">{formatCents(revenue)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Events */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Upcoming Events</h2>
              <Link href="/dashboard/events" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No upcoming events scheduled.
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/dashboard/events/${event.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Camera className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.school.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.type === "retake" ? "Retake Day" : "Picture Day"}
                        {event.startTime ? ` at ${event.startTime}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">{formatRelativeDate(event.date)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(event.date)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Recent Orders</h2>
              <Link href="/dashboard/orders" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </div>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No orders yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                      <ShoppingCart className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-medium">
                          {order.orderNumber}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {order.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.event.school.name} &middot; {order.parentName || "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">
                        {formatCents(order.totalAmount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order._count.items} item{order._count.items === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
