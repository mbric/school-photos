"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Calendar,
  Clock,
  GripVertical,
  Printer,
  Users,
  Camera,
  ShoppingCart,
  Pencil,
  Save,
  Link2,
  QrCode,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClassGroup {
  grade: string;
  teacher: string;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  teacher: string | null;
  studentId: string | null;
}

interface EventDetail {
  id: string;
  type: string;
  date: string;
  startTime: string | null;
  notes: string | null;
  classOrder: string | null;
  status: string;
  posesPerStudent: number;
  matchingMethod: string;
  school: {
    id: string;
    name: string;
    students: Student[];
  };
  _count: { checkIns: number; photos: number; orders: number };
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [classOrder, setClassOrder] = useState<ClassGroup[]>([]);
  const [showShotList, setShowShotList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMatchingMethod, setEditMatchingMethod] = useState<string>("sequence");

  const fetchEvent = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}`);
    if (!res.ok) {
      router.push("/dashboard/events");
      return;
    }
    const data = await res.json();
    setEvent(data.event);

    // Parse or derive class order
    if (data.event.classOrder) {
      setClassOrder(JSON.parse(data.event.classOrder));
    } else {
      // Derive from students
      const groups = new Map<string, ClassGroup>();
      for (const s of data.event.school.students) {
        const key = `${s.grade}|${s.teacher || "Unassigned"}`;
        if (!groups.has(key)) {
          groups.set(key, { grade: s.grade, teacher: s.teacher || "Unassigned" });
        }
      }
      setClassOrder(Array.from(groups.values()).sort((a, b) => a.grade.localeCompare(b.grade)));
    }

    setLoading(false);
  }, [eventId, router]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  async function saveClassOrder() {
    setSaving(true);
    await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classOrder }),
    });
    setSaving(false);
    setEditing(false);
  }

  async function handleEditEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: fd.get("date") as string,
        startTime: fd.get("startTime") as string,
        notes: fd.get("notes") as string,
        posesPerStudent: parseInt(fd.get("posesPerStudent") as string) || 1,
        matchingMethod: fd.get("matchingMethod") as string,
      }),
    });
    fetchEvent();
    setEditing(false);
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!event) return null;

  const date = new Date(event.date);

  // Group students by class for shot list
  const studentsByClass = new Map<string, Student[]>();
  for (const s of event.school.students) {
    const key = `${s.grade}|${s.teacher || "Unassigned"}`;
    if (!studentsByClass.has(key)) studentsByClass.set(key, []);
    studentsByClass.get(key)!.push(s);
  }

  return (
    <div>
      <Link
        href="/dashboard/events"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Events
      </Link>

      {/* Event Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-2xl font-bold">{event.school.name}</h1>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            event.status === "scheduled" ? "bg-blue-100 text-blue-700" :
            event.status === "in_progress" ? "bg-yellow-100 text-yellow-700" :
            "bg-green-100 text-green-700"
          }`}>
            {event.status.replace("_", " ")}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {event.type}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {date.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          {event.startTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {event.startTime}
            </span>
          )}
          {event.notes && (
            <span className="text-muted-foreground">{event.notes}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/events/${eventId}/shoot`}>
            <Button size="sm">
              <Camera className="h-3.5 w-3.5 mr-1.5" /> Shoot Day
            </Button>
          </Link>
          <Link href={`/dashboard/events/${eventId}/photos`}>
            <Button size="sm" variant="outline">
              <Camera className="h-3.5 w-3.5 mr-1.5" /> Photos
            </Button>
          </Link>
          <Link href={`/dashboard/events/${eventId}/proofs`}>
            <Button size="sm" variant="outline">
              <Link2 className="h-3.5 w-3.5 mr-1.5" /> Proofs
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={() => { setEditMatchingMethod(event.matchingMethod || "sequence"); setEditing(!editing); }}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowShotList(!showShotList)}>
            <Printer className="h-3.5 w-3.5 mr-1.5" /> Shot List
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(`/api/events/${eventId}/qr-sheet`, "_blank")}
          >
            <QrCode className="h-3.5 w-3.5 mr-1.5" /> QR Sheets
          </Button>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <form onSubmit={handleEditEvent} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input name="date" type="date" defaultValue={event.date.split("T")[0]} />
                </div>
                <div className="space-y-1">
                  <Label>Start Time</Label>
                  <Input name="startTime" type="time" defaultValue={event.startTime || ""} />
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Input name="notes" defaultValue={event.notes || ""} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Matching Method</Label>
                <select
                  name="matchingMethod"
                  value={editMatchingMethod}
                  onChange={(e) => setEditMatchingMethod(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="sequence">Sequence (check-in order)</option>
                  <option value="qr">QR Code (separator photos)</option>
                  <option value="filename">Filename (student ID in name)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {editMatchingMethod === "qr"
                    ? "QR photos separate students automatically — any number of poses per student."
                    : editMatchingMethod === "filename"
                    ? "Photos are matched by student ID found in the filename."
                    : "Photos are matched to students by check-in order."}
                </p>
              </div>
              {editMatchingMethod === "sequence" && (
                <div className="space-y-1">
                  <Label>Poses per Student</Label>
                  <select
                    name="posesPerStudent"
                    defaultValue={event.posesPerStudent || 1}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="1">1 pose</option>
                    <option value="2">2 poses</option>
                    <option value="3">3 poses</option>
                    <option value="4">4 poses</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Only needed for sequence matching — groups every N photos to one student.
                  </p>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="flex gap-6 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{event.school.students.length}</span>
          <span className="text-muted-foreground">Students</span>
        </div>
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{event._count.checkIns}</span>
          <span className="text-muted-foreground">Check-ins</span>
        </div>
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{event._count.orders}</span>
          <span className="text-muted-foreground">Orders</span>
        </div>
      </div>

      {/* Class Order Editor */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Class Shooting Order</CardTitle>
            <Button size="sm" onClick={saveClassOrder} disabled={saving}>
              <Save className="h-3.5 w-3.5 mr-1" />
              {saving ? "Saving..." : "Save Order"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Drag to reorder. This determines the order classes will be photographed.
          </p>
        </CardHeader>
        <CardContent>
          <ClassOrderList classOrder={classOrder} setClassOrder={setClassOrder} studentsByClass={studentsByClass} />
        </CardContent>
      </Card>

      {/* Shot List */}
      {showShotList && (
        <ShotList
          classOrder={classOrder}
          studentsByClass={studentsByClass}
          schoolName={event.school.name}
          date={date}
          onClose={() => setShowShotList(false)}
        />
      )}
    </div>
  );
}

// ─── Class Order Drag & Drop ──────────────────────────

function ClassOrderList({
  classOrder,
  setClassOrder,
  studentsByClass,
}: {
  classOrder: ClassGroup[];
  setClassOrder: (order: ClassGroup[]) => void;
  studentsByClass: Map<string, Student[]>;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIndex = classOrder.findIndex((c) => `${c.grade}|${c.teacher}` === active.id);
      const newIndex = classOrder.findIndex((c) => `${c.grade}|${c.teacher}` === over.id);
      setClassOrder(arrayMove(classOrder, oldIndex, newIndex));
    }
  }

  const ids = classOrder.map((c) => `${c.grade}|${c.teacher}`);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {classOrder.map((group, index) => {
            const key = `${group.grade}|${group.teacher}`;
            const count = studentsByClass.get(key)?.length || 0;
            return (
              <SortableClassItem
                key={key}
                id={key}
                index={index}
                group={group}
                studentCount={count}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableClassItem({
  id,
  index,
  group,
  studentCount,
}: {
  id: string;
  index: number;
  group: ClassGroup;
  studentCount: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border bg-background px-3 py-2"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-sm font-medium w-6 text-muted-foreground">{index + 1}.</span>
      <span className="text-sm font-medium">Grade {group.grade}</span>
      <span className="text-sm text-muted-foreground">— {group.teacher}</span>
      <span className="ml-auto text-xs text-muted-foreground">{studentCount} students</span>
    </div>
  );
}

// ─── Shot List ────────────────────────────────────────

function ShotList({
  classOrder,
  studentsByClass,
  schoolName,
  date,
  onClose,
}: {
  classOrder: ClassGroup[];
  studentsByClass: Map<string, Student[]>;
  schoolName: string;
  date: Date;
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Shot List - ${schoolName}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 20px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 14px; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        .meta { font-size: 12px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
        th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid #eee; }
        th { font-weight: 600; background: #f5f5f5; }
        .check { width: 30px; text-align: center; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Shot List</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5 mr-1" /> Print
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={printRef}>
          <h1>{schoolName} — Picture Day Shot List</h1>
          <p className="meta">
            {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>

          {classOrder.map((group) => {
            const key = `${group.grade}|${group.teacher}`;
            const students = studentsByClass.get(key) || [];
            return (
              <div key={key} className="mb-6">
                <h2 className="text-sm font-semibold border-b pb-1 mb-2">
                  Grade {group.grade} — {group.teacher} ({students.length} students)
                </h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-1.5 w-8">#</th>
                      <th className="text-left px-3 py-1.5">Name</th>
                      <th className="text-left px-3 py-1.5">Student ID</th>
                      <th className="text-center px-3 py-1.5 w-16">Done</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students
                      .sort((a, b) => a.lastName.localeCompare(b.lastName))
                      .map((s, i) => (
                        <tr key={s.id} className="border-b border-muted/50">
                          <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-1.5 font-medium">
                            {s.lastName}, {s.firstName}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {s.studentId || "—"}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <span className="inline-block w-4 h-4 border rounded border-muted-foreground/30" />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
