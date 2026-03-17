import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, School, ShoppingCart, Camera } from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [schoolCount, eventCount, photoCount, orderCount] = await Promise.all([
    prisma.school.count({ where: { photographerId: user.id } }),
    prisma.event.count({
      where: { photographerId: user.id, date: { gte: new Date() } },
    }),
    prisma.photo.count({
      where: { event: { photographerId: user.id } },
    }),
    prisma.order.count({
      where: { event: { photographerId: user.id }, status: "pending" },
    }),
  ]);

  const stats = [
    { label: "Schools", value: schoolCount, icon: School },
    { label: "Upcoming Events", value: eventCount, icon: Calendar },
    { label: "Photos", value: photoCount, icon: Camera },
    { label: "Pending Orders", value: orderCount, icon: ShoppingCart },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">
        Welcome back, {user.name?.split(" ")[0]}
      </h1>
      <p className="text-muted-foreground mb-8">
        Here&apos;s an overview of your photography business.
      </p>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </span>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
