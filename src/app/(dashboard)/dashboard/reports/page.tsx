"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  DollarSign,
  Users,
  Camera,
  FileDown,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";

interface SchoolRevenue {
  schoolId: string;
  schoolName: string;
  events: {
    eventId: string;
    date: string;
    type: string;
    orderCount: number;
    revenue: number;
    studentCount: number;
    photographedCount: number;
    absentCount: number;
    unmatchedPhotos: number;
  }[];
  totalRevenue: number;
  totalOrders: number;
}

interface MissingStudent {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  teacher: string | null;
  status: string;
}

interface ReportData {
  schools: SchoolRevenue[];
  totals: {
    revenue: number;
    orders: number;
    schools: number;
    events: number;
  };
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"revenue" | "missing">("revenue");
  const [expandedSchool, setExpandedSchool] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [missingStudents, setMissingStudents] = useState<MissingStudent[]>([]);
  const [missingLoading, setMissingLoading] = useState(false);

  const fetchReportData = useCallback(async () => {
    const res = await fetch("/api/reports");
    if (res.ok) {
      const json = await res.json();
      setData(json);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  async function fetchMissingStudents(eventId: string) {
    setMissingLoading(true);
    setSelectedEvent(eventId);
    const res = await fetch(`/api/reports/missing?eventId=${eventId}`);
    if (res.ok) {
      const json = await res.json();
      setMissingStudents(json.students || []);
    }
    setMissingLoading(false);
  }

  function downloadCsv(filename: string, rows: string[][]) {
    const csv = rows.map((row) =>
      row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportRevenueCsv() {
    if (!data) return;
    const rows: string[][] = [
      ["School", "Event Date", "Type", "Orders", "Revenue", "Students", "Photographed", "Absent", "Unmatched Photos"],
    ];
    for (const school of data.schools) {
      for (const event of school.events) {
        rows.push([
          school.schoolName,
          event.date,
          event.type,
          String(event.orderCount),
          (event.revenue / 100).toFixed(2),
          String(event.studentCount),
          String(event.photographedCount),
          String(event.absentCount),
          String(event.unmatchedPhotos),
        ]);
      }
    }
    downloadCsv("revenue-report.csv", rows);
  }

  function exportMissingCsv() {
    if (missingStudents.length === 0) return;
    const rows: string[][] = [
      ["Last Name", "First Name", "Grade", "Teacher", "Status"],
    ];
    for (const s of missingStudents) {
      rows.push([s.lastName, s.firstName, s.grade, s.teacher || "", s.status]);
    }
    downloadCsv("missing-students.csv", rows);
  }

  function formatCents(cents: number) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  if (loading) return <p className="text-muted-foreground">Loading reports...</p>;
  if (!data) return <p className="text-muted-foreground">Failed to load reports.</p>;

  // Collect all events for the missing student selector
  const allEvents = data.schools.flatMap((s) =>
    s.events.map((e) => ({
      eventId: e.eventId,
      label: `${s.schoolName} — ${e.date} (${e.type})`,
    }))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Business analytics and event reports</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        <button
          onClick={() => setActiveTab("revenue")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "revenue"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <DollarSign className="h-4 w-4 inline mr-1.5" />
          Revenue
        </button>
        <button
          onClick={() => setActiveTab("missing")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "missing"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4 inline mr-1.5" />
          Missing Students
        </button>
      </div>

      {/* ─── Revenue Tab ─── */}
      {activeTab === "revenue" && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCents(data.totals.revenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Orders</p>
                <p className="text-2xl font-bold">{data.totals.orders}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Schools</p>
                <p className="text-2xl font-bold">{data.totals.schools}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Events</p>
                <p className="text-2xl font-bold">{data.totals.events}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={exportRevenueCsv}>
              <FileDown className="h-3.5 w-3.5 mr-1" /> Export CSV
            </Button>
          </div>

          {/* Per-school breakdown */}
          {data.schools.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No data yet. Revenue will appear once orders come in.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.schools.map((school) => {
                const isExpanded = expandedSchool === school.schoolId;
                return (
                  <Card key={school.schoolId}>
                    <CardContent className="p-4">
                      <div
                        className="flex items-center gap-4 cursor-pointer"
                        onClick={() =>
                          setExpandedSchool(isExpanded ? null : school.schoolId)
                        }
                      >
                        <div className="flex-1">
                          <p className="font-semibold">{school.schoolName}</p>
                          <p className="text-sm text-muted-foreground">
                            {school.totalOrders} order{school.totalOrders === 1 ? "" : "s"} &middot;{" "}
                            {school.events.length} event{school.events.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <p className="text-lg font-bold">{formatCents(school.totalRevenue)}</p>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      {isExpanded && (
                        <div className="mt-4 border-t pt-4">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left px-3 py-2">Date</th>
                                <th className="text-left px-3 py-2">Type</th>
                                <th className="text-right px-3 py-2">Students</th>
                                <th className="text-right px-3 py-2">Photographed</th>
                                <th className="text-right px-3 py-2">Orders</th>
                                <th className="text-right px-3 py-2">Revenue</th>
                              </tr>
                            </thead>
                            <tbody>
                              {school.events.map((event) => (
                                <tr key={event.eventId} className="border-t">
                                  <td className="px-3 py-2">{event.date}</td>
                                  <td className="px-3 py-2 capitalize">{event.type}</td>
                                  <td className="px-3 py-2 text-right">{event.studentCount}</td>
                                  <td className="px-3 py-2 text-right">
                                    {event.photographedCount}
                                    {event.absentCount > 0 && (
                                      <span className="text-amber-600 ml-1">
                                        ({event.absentCount} absent)
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right">{event.orderCount}</td>
                                  <td className="px-3 py-2 text-right font-medium">
                                    {formatCents(event.revenue)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Missing Students Tab ─── */}
      {activeTab === "missing" && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select Event</label>
            <select
              value={selectedEvent || ""}
              onChange={(e) => {
                if (e.target.value) fetchMissingStudents(e.target.value);
                else {
                  setSelectedEvent(null);
                  setMissingStudents([]);
                }
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm w-full max-w-md"
            >
              <option value="">Choose an event...</option>
              {allEvents.map((e) => (
                <option key={e.eventId} value={e.eventId}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>

          {selectedEvent && (
            <>
              {missingLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : missingStudents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>All students have been photographed for this event.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-muted-foreground">
                      <AlertTriangle className="h-4 w-4 inline mr-1 text-amber-500" />
                      {missingStudents.length} student{missingStudents.length === 1 ? "" : "s"} missing or absent
                    </p>
                    <Button variant="outline" size="sm" onClick={exportMissingCsv}>
                      <FileDown className="h-3.5 w-3.5 mr-1" /> Export CSV
                    </Button>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium">Name</th>
                          <th className="text-left px-4 py-3 font-medium">Grade</th>
                          <th className="text-left px-4 py-3 font-medium">Teacher</th>
                          <th className="text-left px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {missingStudents.map((s) => (
                          <tr key={s.id} className="border-t hover:bg-muted/30">
                            <td className="px-4 py-3 font-medium">
                              {s.lastName}, {s.firstName}
                            </td>
                            <td className="px-4 py-3">{s.grade}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {s.teacher || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
