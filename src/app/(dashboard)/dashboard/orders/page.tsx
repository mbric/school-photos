"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Search,
  ShoppingCart,
  DollarSign,
  Clock,
  CheckCircle2,
  Truck,
  Package,
  ChevronDown,
  ChevronUp,
  FileDown,
} from "lucide-react";

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  package: { name: string };
  student: { firstName: string; lastName: string; grade: string };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  source: string;
  totalAmount: number;
  parentName: string | null;
  parentEmail: string | null;
  notes: string | null;
  stripePaymentId: string | null;
  createdAt: string;
  event: {
    id: string;
    date: string;
    school: { id: string; name: string };
  };
  items: OrderItem[];
  _count: { items: number };
}

interface Stats {
  total: number;
  pending: number;
  paid: number;
  fulfilled: number;
  totalRevenue: number;
}

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "awaiting_payment", label: "Awaiting Payment" },
  { value: "paid", label: "Paid" },
  { value: "sent_to_lab", label: "Sent to Lab" },
  { value: "printed", label: "Printed" },
  { value: "delivered", label: "Delivered" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  awaiting_payment: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  sent_to_lab: "bg-blue-100 text-blue-700",
  printed: "bg-purple-100 text-purple-700",
  delivered: "bg-emerald-100 text-emerald-700",
};

const NEXT_STATUS: Record<string, string> = {
  awaiting_payment: "paid",
  paid: "sent_to_lab",
  sent_to_lab: "printed",
  printed: "delivered",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (statusFilter) qs.set("status", statusFilter);

    const res = await fetch(`/api/orders?${qs}`);
    const data = await res.json();
    setOrders(data.orders || []);
    setStats(data.stats || null);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  async function updateStatus(orderId: string, newStatus: string) {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) fetchOrders();
  }

  async function deleteOrder(orderId: string, orderNumber: string) {
    if (!confirm(`Delete order ${orderNumber}? This cannot be undone.`)) return;
    const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
    if (res.ok) fetchOrders();
  }

  function formatCents(cents: number) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (loading) return <p className="text-muted-foreground">Loading orders...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-muted-foreground">
            Manage all photo package orders
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Orders</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.paid}</p>
                <p className="text-xs text-muted-foreground">Paid</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">{formatCents(stats.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Revenue</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No orders yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isExpanded = expandedOrder === order.id;
            const nextStatus = NEXT_STATUS[order.status];

            return (
              <Card key={order.id}>
                <CardContent className="p-4">
                  {/* Order header row */}
                  <div
                    className="flex items-center gap-4 cursor-pointer"
                    onClick={() =>
                      setExpandedOrder(isExpanded ? null : order.id)
                    }
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-semibold text-sm">
                          {order.orderNumber}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {order.status.replace(/_/g, " ")}
                        </span>
                        {order.source === "paper" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                            paper
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.event.school.name} &middot;{" "}
                        {order.parentName || "—"} &middot;{" "}
                        {order._count.items} item(s)
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCents(order.totalAmount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {/* Contact info */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Parent:</span>{" "}
                          {order.parentName || "—"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Email:</span>{" "}
                          {order.parentEmail || "—"}
                        </div>
                        {order.notes && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Notes:</span>{" "}
                            {order.notes}
                          </div>
                        )}
                      </div>

                      {/* Line items */}
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-3 py-2">Student</th>
                              <th className="text-left px-3 py-2">Package</th>
                              <th className="text-right px-3 py-2">Qty</th>
                              <th className="text-right px-3 py-2">Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item) => (
                              <tr key={item.id} className="border-t">
                                <td className="px-3 py-2">
                                  {item.student.lastName},{" "}
                                  {item.student.firstName}
                                </td>
                                <td className="px-3 py-2">
                                  {item.package.name}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {item.quantity}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {formatCents(item.unitPrice * item.quantity)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 justify-end">
                        {nextStatus && (
                          <Button
                            size="sm"
                            onClick={() => updateStatus(order.id, nextStatus)}
                          >
                            <Truck className="h-3.5 w-3.5 mr-1" />
                            Mark as {nextStatus.replace(/_/g, " ")}
                          </Button>
                        )}
                        {(order.status === "pending" ||
                          order.status === "awaiting_payment") && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              deleteOrder(order.id, order.orderNumber)
                            }
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
