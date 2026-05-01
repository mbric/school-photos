"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Papa from "papaparse";
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
  Upload,
  X,
  AlertTriangle,
  School,
  Check,
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
  enrollmentId: string;
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

function gradeLabel(grade: string) {
  return grade ? `Grade ${grade}` : "Unassigned";
}

function gradeKey(grade: string, teacher: string | null) {
  return `${grade || ""}|${teacher || "Unassigned"}`;
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
  const [showImport, setShowImport] = useState(false);
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

    if (data.event.classOrder) {
      setClassOrder(JSON.parse(data.event.classOrder));
    } else {
      const groups = new Map<string, ClassGroup>();
      for (const s of data.event.school.students) {
        const grade = s.grade || "";
        const teacher = s.teacher || "Unassigned";
        const key = gradeKey(grade, teacher);
        if (!groups.has(key)) groups.set(key, { grade, teacher });
      }
      setClassOrder(
        Array.from(groups.values()).sort((a, b) => a.grade.localeCompare(b.grade))
      );
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

  const studentsByClass = new Map<string, Student[]>();
  for (const s of event.school.students) {
    const key = gradeKey(s.grade, s.teacher);
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
              timeZone: "UTC",
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
          <Button size="sm" variant="outline" onClick={() => setShowImport(!showImport)}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Import Roster
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

      {/* Import Roster */}
      {showImport && (
        <EventRosterImport
          eventId={eventId}
          schoolId={event.school.id}
          onDone={() => { setShowImport(false); fetchEvent(); }}
          onCancel={() => setShowImport(false)}
        />
      )}

      {/* Stats */}
      <div className="flex gap-6 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{event.school.students.length}</span>
          <span className="text-muted-foreground">Enrolled</span>
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

      {/* Enrolled Roster */}
      {event.school.students.length > 0 && (
        <EnrolledRoster
          eventId={eventId}
          students={event.school.students}
          onRefresh={fetchEvent}
        />
      )}

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

// ─── Enrolled Roster ──────────────────────────────────

function EnrolledRoster({
  eventId,
  students,
  onRefresh,
}: {
  eventId: string;
  students: Student[];
  onRefresh: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editGrade, setEditGrade] = useState("");
  const [editTeacher, setEditTeacher] = useState("");
  const [saving, setSaving] = useState(false);
  const [groupByTeacher, setGroupByTeacher] = useState(true);

  function startEdit(s: Student) {
    setEditingId(s.id);
    setEditGrade(s.grade || "");
    setEditTeacher(s.teacher || "");
  }

  async function saveEdit(studentId: string) {
    setSaving(true);
    await fetch(`/api/events/${eventId}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, grade: editGrade, teacher: editTeacher }),
    });
    setSaving(false);
    setEditingId(null);
    onRefresh();
  }

  // Group students by teacher when toggle is on
  const grouped = groupByTeacher
    ? (() => {
        const map = new Map<string, Student[]>();
        for (const s of students) {
          const key = `${s.grade || "—"}|${s.teacher || "Unassigned"}`;
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(s);
        }
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
      })()
    : null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Event Roster</CardTitle>
          <button
            onClick={() => setGroupByTeacher(!groupByTeacher)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              groupByTeacher
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input text-muted-foreground hover:bg-muted"
            }`}
          >
            Group by Teacher
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {students.length} students enrolled. Click Edit to assign grade and teacher.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {groupByTeacher && grouped ? (
          grouped.map(([key, group]) => {
            const [grade, teacher] = key.split("|");
            return (
              <div key={key}>
                <div className="px-4 py-2 bg-muted/40 border-y text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {grade !== "—" ? `Grade ${grade}` : "No Grade"} — {teacher}
                </div>
                <RosterTable
                  students={group}
                  editingId={editingId}
                  editGrade={editGrade}
                  editTeacher={editTeacher}
                  saving={saving}
                  onStartEdit={startEdit}
                  onCancelEdit={() => setEditingId(null)}
                  onSaveEdit={saveEdit}
                  onEditGrade={setEditGrade}
                  onEditTeacher={setEditTeacher}
                />
              </div>
            );
          })
        ) : (
          <RosterTable
            students={[...students].sort((a, b) => a.lastName.localeCompare(b.lastName))}
            editingId={editingId}
            editGrade={editGrade}
            editTeacher={editTeacher}
            saving={saving}
            onStartEdit={startEdit}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={saveEdit}
            onEditGrade={setEditGrade}
            onEditTeacher={setEditTeacher}
          />
        )}
      </CardContent>
    </Card>
  );
}

function RosterTable({
  students,
  editingId,
  editGrade,
  editTeacher,
  saving,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditGrade,
  onEditTeacher,
}: {
  students: Student[];
  editingId: string | null;
  editGrade: string;
  editTeacher: string;
  saving: boolean;
  onStartEdit: (s: Student) => void;
  onCancelEdit: () => void;
  onSaveEdit: (studentId: string) => void;
  onEditGrade: (v: string) => void;
  onEditTeacher: (v: string) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="sr-only">
        <tr>
          <th>Name</th>
          <th>Grade</th>
          <th>Teacher</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {students.map((s) =>
          editingId === s.id ? (
            <tr key={s.id} className="bg-muted/30">
              <td className="px-4 py-2 font-medium">
                {s.lastName}, {s.firstName}
              </td>
              <td className="px-2 py-1.5">
                <Input
                  value={editGrade}
                  onChange={(e) => onEditGrade(e.target.value)}
                  placeholder="Grade"
                  className="h-7 text-sm w-20"
                  autoFocus
                />
              </td>
              <td className="px-2 py-1.5">
                <Input
                  value={editTeacher}
                  onChange={(e) => onEditTeacher(e.target.value)}
                  placeholder="Teacher"
                  className="h-7 text-sm w-36"
                />
              </td>
              <td className="px-2 py-1.5 text-right">
                <div className="flex gap-1 justify-end">
                  <Button size="sm" className="h-7 px-2" onClick={() => onSaveEdit(s.id)} disabled={saving}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCancelEdit}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ) : (
            <tr key={s.id} className="hover:bg-muted/20">
              <td className="px-4 py-2 font-medium">
                {s.lastName}, {s.firstName}
                {s.studentId && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">{s.studentId}</span>
                )}
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {s.grade || <span className="italic text-muted-foreground/60">—</span>}
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {s.teacher || <span className="italic text-muted-foreground/60">—</span>}
              </td>
              <td className="px-4 py-2 text-right">
                <button
                  onClick={() => onStartEdit(s)}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-muted"
                >
                  Edit
                </button>
              </td>
            </tr>
          )
        )}
      </tbody>
    </table>
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
      const oldIndex = classOrder.findIndex((c) => gradeKey(c.grade, c.teacher) === active.id);
      const newIndex = classOrder.findIndex((c) => gradeKey(c.grade, c.teacher) === over.id);
      setClassOrder(arrayMove(classOrder, oldIndex, newIndex));
    }
  }

  const ids = classOrder.map((c) => gradeKey(c.grade, c.teacher));

  if (classOrder.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No classes yet. Import a roster to get started.
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {classOrder.map((group, index) => {
            const key = gradeKey(group.grade, group.teacher);
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
      <span className="text-sm font-medium">{gradeLabel(group.grade)}</span>
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
            {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}
          </p>

          {classOrder.map((group) => {
            const key = gradeKey(group.grade, group.teacher);
            const students = studentsByClass.get(key) || [];
            return (
              <div key={key} className="mb-6">
                <h2 className="text-sm font-semibold border-b pb-1 mb-2">
                  {gradeLabel(group.grade)} — {group.teacher} ({students.length} students)
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

// ─── Event Roster Import ──────────────────────────────

interface CsvRow { [key: string]: string; }

function EventRosterImport({
  eventId,
  schoolId,
  onDone,
  onCancel,
}: {
  eventId: string;
  schoolId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "csv-map" | "csv-preview" | "warn" | "result">("choose");
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [warning, setWarning] = useState<{ checkInCount: number; message: string } | null>(null);
  const [result, setResult] = useState<{ created?: number; updated?: number; enrolled: number; errors?: { row: number; message: string }[]; total?: number; alreadyEnrolled?: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const fields = [
    { key: "firstName", label: "First Name", required: true },
    { key: "lastName", label: "Last Name", required: true },
    { key: "grade", label: "Grade", required: true },
    { key: "teacher", label: "Teacher", required: false },
    { key: "studentId", label: "Student ID", required: false },
    { key: "parentEmail", label: "Parent Email", required: false },
  ];

  async function importFromSchool() {
    setLoading(true);
    const res = await fetch(`/api/events/${eventId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "from-school" }),
    });
    const data = await res.json();
    setLoading(false);
    setResult({ enrolled: data.enrolled, alreadyEnrolled: data.alreadyEnrolled, total: data.total });
    setMode("result");
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
        const hdrs = results.meta.fields || [];
        setHeaders(hdrs);
        const autoMap: Record<string, string> = {};
        for (const field of fields) {
          const match = hdrs.find((h) => {
            const lower = h.toLowerCase().replace(/[^a-z]/g, "");
            if (field.key === "firstName") return lower.includes("first") || lower === "firstname";
            if (field.key === "lastName") return lower.includes("last") || lower === "lastname";
            if (field.key === "grade") return lower.includes("grade") || lower.includes("level");
            if (field.key === "teacher") return lower.includes("teacher") || lower.includes("class");
            if (field.key === "studentId") return lower.includes("studentid") || lower === "id";
            if (field.key === "parentEmail") return lower.includes("email") || lower.includes("parent");
            return false;
          });
          if (match) autoMap[field.key] = match;
        }
        setMapping(autoMap);
        setMode("csv-map");
      },
    });
  }

  function getMappedStudents() {
    return csvData.map((row) => ({
      firstName: (row[mapping.firstName] || "").trim(),
      lastName: (row[mapping.lastName] || "").trim(),
      grade: (row[mapping.grade] || "").trim(),
      teacher: (row[mapping.teacher] || "").trim() || undefined,
      studentId: (row[mapping.studentId] || "").trim() || undefined,
      parentEmail: (row[mapping.parentEmail] || "").trim() || undefined,
    }));
  }

  async function doCsvImport(confirm = false) {
    setLoading(true);
    const res = await fetch(`/api/events/${eventId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ students: getMappedStudents(), confirm }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.status === 409 && data.warning) {
      setWarning({ checkInCount: data.checkInCount, message: data.message });
      setMode("warn");
      return;
    }

    setResult(data);
    setMode("result");
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Import Roster</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === "choose" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              How do you want to populate this event's roster?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={importFromSchool}
                disabled={loading}
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-input hover:border-primary hover:bg-muted/30 p-4 text-left transition-colors"
              >
                <School className="h-7 w-7 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">From School Roster</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enroll all students already in the school. Assign grades &amp; teachers after.
                  </p>
                </div>
                {loading && <span className="text-xs text-muted-foreground">Enrolling…</span>}
              </button>
              <label className="flex flex-col items-center gap-2 rounded-lg border-2 border-input hover:border-primary hover:bg-muted/30 p-4 text-left transition-colors cursor-pointer">
                <Upload className="h-7 w-7 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Upload CSV</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Import from a roster file. Grade and teacher are set from the CSV.
                  </p>
                </div>
                <input type="file" accept=".csv" className="sr-only" onChange={handleFileSelect} />
              </label>
            </div>
          </div>
        )}

        {mode === "csv-map" && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Map your CSV columns. Found {csvData.length} rows.
            </p>
            <div className="space-y-2 mb-4">
              {fields.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <span className="text-sm w-32 shrink-0">
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </span>
                  <select
                    value={mapping[field.key] || ""}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm flex-1"
                  >
                    <option value="">— Skip —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setMode("choose")}>Back</Button>
              <Button
                onClick={() => setMode("csv-preview")}
                disabled={!mapping.firstName || !mapping.lastName || !mapping.grade}
              >
                Preview
              </Button>
            </div>
          </div>
        )}

        {mode === "csv-preview" && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              First 5 rows of {csvData.length} students.
            </p>
            <div className="border rounded-md overflow-auto mb-4">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-left px-3 py-2">Grade</th>
                    <th className="text-left px-3 py-2">Teacher</th>
                    <th className="text-left px-3 py-2">Student ID</th>
                  </tr>
                </thead>
                <tbody>
                  {getMappedStudents().slice(0, 5).map((s, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">{s.firstName} {s.lastName}</td>
                      <td className="px-3 py-2">{s.grade}</td>
                      <td className="px-3 py-2">{s.teacher || "—"}</td>
                      <td className="px-3 py-2">{s.studentId || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setMode("csv-map")}>Back</Button>
              <Button onClick={() => doCsvImport(false)} disabled={loading}>
                {loading ? "Importing…" : `Import ${csvData.length} Students`}
              </Button>
            </div>
          </div>
        )}

        {mode === "warn" && warning && (
          <div>
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-4">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">{warning.message}</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
              <Button onClick={() => doCsvImport(true)} disabled={loading}>
                {loading ? "Importing…" : "Yes, proceed"}
              </Button>
            </div>
          </div>
        )}

        {mode === "result" && result && (
          <div>
            {result.enrolled !== undefined && result.alreadyEnrolled !== undefined ? (
              <p className="text-sm font-medium text-green-700 mb-1">
                Enrolled {result.enrolled} new student{result.enrolled !== 1 ? "s" : ""}
                {result.alreadyEnrolled > 0 && ` (${result.alreadyEnrolled} already enrolled)`}.
                {result.enrolled > 0 && " Assign grades and teachers in the roster below."}
              </p>
            ) : (
              <p className="text-sm font-medium text-green-700 mb-1">
                Enrolled {result.enrolled} of {result.total} students
                {result.created && result.created > 0 ? ` (${result.created} new)` : ""}
                {result.updated && result.updated > 0 ? `, ${result.updated} updated` : ""}.
              </p>
            )}
            {result.errors && result.errors.length > 0 && (
              <ul className="text-sm text-destructive space-y-1 mt-2 max-h-32 overflow-auto">
                {result.errors.map((err, i) => (
                  <li key={i}>Row {err.row}: {err.message}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end mt-4">
              <Button onClick={onDone}>Done</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
