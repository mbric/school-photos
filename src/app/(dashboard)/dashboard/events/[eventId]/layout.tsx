"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { EventContext, type EventDetail, type ClassGroup, type Student } from "./event-context";
import Link from "next/link";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Camera,
  Upload,
  Link2,
  Printer,
  QrCode,
  Pencil,
  ShoppingCart,
  Users,
  School,
  AlertTriangle,
  X,
} from "lucide-react";
import { ProcessProgress } from "@/components/ProcessProgress";

// ─── Types ────────────────────────────────────────────

// EventDetail, ClassGroup, Student are imported from event-context

type EventPhase =
  | "setup"
  | "pre-shoot-ungrouped"
  | "pre-shoot-ready"
  | "shoot-day"
  | "picture-day"
  | "post-shoot"
  | "selection"
  | "completed";

function gradeKey(grade: string, teacher: string | null) {
  return `${grade || ""}|${teacher || "Unassigned"}`;
}

// ─── Layout ───────────────────────────────────────────

export default function EventLayout({ children }: { children: React.ReactNode }) {
  const { eventId } = useParams<{ eventId: string }>();
  const pathname = usePathname();
  const router = useRouter();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [classOrder, setClassOrder] = useState<ClassGroup[]>([]);
  const [editing, setEditing] = useState(false);
  const [editMatchingMethod, setEditMatchingMethod] = useState("sequence");
  const [showImport, setShowImport] = useState(false);
  const [showShotList, setShowShotList] = useState(false);
  const didInitialRedirect = useRef(false);

  // ── Derived values (needed before effects) ──
  const base = `/dashboard/events/${eventId}`;
  const tabs = [
    { href: base, label: "Setup" },
    { href: `${base}/shoot`, label: "Shoot Day" },
    { href: `${base}/photos`, label: "Photos" },
    { href: `${base}/proofs`, label: "Proofs" },
  ];

  // ── Phase detection ──
  const hasStudents = (event?.school.students.length ?? 0) > 0;
  const hasCheckIns = (event?._count.checkIns ?? 0) > 0;
  const hasPhotos = (event?._count.photos ?? 0) > 0;
  const hasOrders = (event?._count.orders ?? 0) > 0;
  const unassignedCount =
    event?.school.students.filter((s) => !s.grade && !s.teacher).length ?? 0;
  const allGrouped = hasStudents && unassignedCount === 0;

  const shootComplete = event?.status === "post_shoot" || event?.status === "photos_ready" || event?.status === "completed";
  const uploadComplete = event?.status === "photos_ready" || event?.status === "completed";

  const eventPhase: EventPhase = event?.status === "completed"
    ? "completed"
    : !hasStudents
    ? "setup"
    : !hasCheckIns && !allGrouped
    ? "pre-shoot-ungrouped"
    : !hasCheckIns
    ? "pre-shoot-ready"
    : !shootComplete
    ? "shoot-day"
    : !uploadComplete
    ? "picture-day"
    : !hasOrders
    ? "post-shoot"
    : "selection";

  const fetchEvent = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}`);
    if (!res.ok) { router.push("/dashboard/events"); return null; }
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
    return data.event as EventDetail;
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent, pathname]);

  // Redirect to the most relevant tab on initial arrival at the base event URL.
  // Once the user is navigating within tabs, respect their choice.
  useEffect(() => {
    if (!event || pathname !== base || didInitialRedirect.current) return;
    didInitialRedirect.current = true;
    if (eventPhase === "shoot-day") {
      router.replace(`${base}/shoot`);
    } else if (eventPhase === "picture-day") {
      router.replace(`${base}/photos`);
    } else if (eventPhase === "post-shoot" || eventPhase === "selection") {
      router.replace(`${base}/proofs`);
    }
  }, [event, pathname, eventPhase, base, router]);

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

  const phaseStepId: Record<EventPhase, string> = {
    setup: "roster-intake",
    "pre-shoot-ungrouped": "generate-flyers",
    "pre-shoot-ready": "generate-flyers",
    "shoot-day": "photograph",
    "picture-day": "upload-photos",
    "post-shoot": "notify-parents",
    selection: "notify-parents",
    completed: "payment",
  };

  async function doneUploading() {
    await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "photos_ready" }),
    });
    router.push(`${base}/proofs`);
  }

  async function backToPhotos() {
    await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "post_shoot" }),
    });
    router.push(`${base}/photos`);
  }

  async function cancelShootDay() {
    if (
      !window.confirm(
        "Go back to Setup? This will permanently delete all check-in and shoot log data for this event. This cannot be undone."
      )
    )
      return;
    await fetch(`/api/events/${eventId}/checkins`, { method: "DELETE" });
    router.push(base);
    // pathname change triggers fetchEvent automatically
  }

  async function endShootDay() {
    if (!window.confirm("End shoot day? This will lock check-ins and move to photo upload.")) return;
    await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "post_shoot" }),
    });
    router.push(`${base}/photos`);
  }

  async function closeEvent() {
    if (!window.confirm("Close this event? This marks it as complete. You can reopen it later if needed.")) return;
    await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    fetchEvent();
  }

  async function reopenEvent() {
    await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "photos_ready" }),
    });
    router.push(`${base}/proofs`);
  }

  async function reOpenShootDay() {
    if (!window.confirm("Re-open shoot day? Check-ins will be editable again.")) return;
    await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress" }),
    });
    router.push(`${base}/shoot`);
    // pathname change triggers fetchEvent automatically
  }

  const nextStep: Record<
    EventPhase,
    { title: string; description: string; button: React.ReactNode; backButton?: React.ReactNode }
  > = {
    setup: {
      title: "Import your roster",
      description: "Add students to this event before picture day.",
      button: (
        <Button onClick={() => setShowImport(true)}>
          <Upload className="h-4 w-4 mr-2" /> Import Roster
        </Button>
      ),
    },
    "pre-shoot-ungrouped": {
      title: "Group your roster by class",
      description: `${unassignedCount} student${unassignedCount !== 1 ? "s" : ""} still unassigned. Assign them to classes in the roster below, then head to shoot day when ready.`,
      button: (
        <Link href={`${base}/shoot`}>
          <Button>
            <Camera className="h-4 w-4 mr-2" /> Done Grouping Roster
          </Button>
        </Link>
      ),
    },
    "pre-shoot-ready": {
      title: "You're ready for shoot day",
      description: `All ${event?.school.students.length ?? 0} students are grouped. Print a shot list or QR sheets, then head to shoot day.`,
      button: (
        <Link href={`${base}/shoot`}>
          <Button>
            <Camera className="h-4 w-4 mr-2" /> Shoot Day
          </Button>
        </Link>
      ),
    },
    "shoot-day": {
      title: "Picture day is in progress",
      description: `${event?._count.checkIns ?? 0} students checked in. When everyone is photographed, end shoot day to move to photo upload.`,
      button: (
        <div className="flex flex-col items-end gap-2">
          <Button onClick={endShootDay}>End Shoot Day</Button>
          {pathname !== `${base}/shoot` && (
            <Link href={`${base}/shoot`} className="text-xs text-muted-foreground hover:text-foreground">
              Go to Shoot Day →
            </Link>
          )}
        </div>
      ),
      backButton: (
        <button onClick={cancelShootDay} className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to Setup
        </button>
      ),
    },
    "picture-day": {
      title: "Upload photos from the shoot",
      description: "Upload and match photos to students. When you've finished uploading all photos, mark as done to move to proofs.",
      button: (
        <div className="flex flex-col items-end gap-2">
          <Button onClick={doneUploading}>Done Uploading</Button>
          {pathname !== `${base}/photos` && (
            <Link href={`${base}/photos`} className="text-xs text-muted-foreground hover:text-foreground">
              Go to Photos →
            </Link>
          )}
        </div>
      ),
      backButton: (
        <button onClick={reOpenShootDay} className="text-xs text-muted-foreground hover:text-foreground">
          ← Re-open Shoot Day
        </button>
      ),
    },
    "post-shoot": {
      title: "Send proof links to parents",
      description: `${event?._count.photos ?? 0} photos uploaded. Notify parents their proofs are ready to view.`,
      button: pathname !== `${base}/proofs` ? (
        <Link href={`${base}/proofs`}>
          <Button>
            <Link2 className="h-4 w-4 mr-2" /> Send Proofs
          </Button>
        </Link>
      ) : null,
      backButton: (
        <button onClick={backToPhotos} className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to Photos
        </button>
      ),
    },
    selection: {
      title: "Orders are coming in",
      description: `${event?._count.orders ?? 0} order${(event?._count.orders ?? 0) !== 1 ? "s" : ""} placed. Review and fulfill when ready, then close the event.`,
      button: (
        <div className="flex flex-col items-end gap-2">
          <Button onClick={closeEvent}>Close Event</Button>
          <Link href="/dashboard/orders" className="text-xs text-muted-foreground hover:text-foreground">
            View Orders →
          </Link>
        </div>
      ),
      backButton: (
        <Link href={`${base}/proofs`} className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to Proofs
        </Link>
      ),
    },
    completed: {
      title: "Event closed",
      description: "This event has been marked as complete. All orders and photos are archived.",
      button: null,
      backButton: (
        <button onClick={reopenEvent} className="text-xs text-muted-foreground hover:text-foreground">
          ← Reopen Event
        </button>
      ),
    },
  };

  const contextValue = useMemo(
    () => ({ event, classOrder, setClassOrder, refreshEvent: fetchEvent }),
    [event, classOrder, fetchEvent]
  );

  // ── ShotList data ──
  const studentsByClass = new Map<string, Student[]>();
  if (event) {
    for (const s of event.school.students) {
      const key = gradeKey(s.grade, s.teacher);
      if (!studentsByClass.has(key)) studentsByClass.set(key, []);
      studentsByClass.get(key)!.push(s);
    }
  }

  return (
    <EventContext.Provider value={contextValue}>
    <div>
      <Link
        href="/dashboard/events"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Events
      </Link>

      {event && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{event.school.name}</h1>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                event.status === "scheduled"
                  ? "bg-blue-100 text-blue-700"
                  : event.status === "in_progress"
                  ? "bg-yellow-100 text-yellow-700"
                  : event.status === "post_shoot"
                  ? "bg-purple-100 text-purple-700"
                  : event.status === "photos_ready"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {event.status === "scheduled"
                ? "scheduled"
                : event.status === "in_progress"
                ? "in progress"
                : event.status === "post_shoot"
                ? "uploading"
                : event.status === "photos_ready"
                ? "proofs"
                : "completed"}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {event.type}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(event.date).toLocaleDateString("en-US", {
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
            {event.notes && <span>{event.notes}</span>}
          </div>
        </div>
      )}

      {/* Process progress + Next Step card */}
      {event && (
        <div className="mb-4">
          <ProcessProgress
            currentStepId={phaseStepId[eventPhase]}
            phaseIds={["onboarding", "pre-shoot", "picture-day", "selection"]}
          />
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">
                  Next step
                </p>
                <p className="font-semibold">{nextStep[eventPhase].title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {nextStep[eventPhase].description}
                </p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                {nextStep[eventPhase].button}
                {nextStep[eventPhase].backButton}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 pt-3 border-t border-amber-200">
              <span className="text-xs text-muted-foreground">All actions:</span>
              <button
                onClick={() => setShowImport(!showImport)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Upload className="h-3 w-3" /> Import Roster
              </button>
              <button
                onClick={() => setShowShotList(!showShotList)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Printer className="h-3 w-3" /> Shot List
              </button>
              <button
                onClick={() =>
                  window.open(`/api/events/${eventId}/qr-sheet`, "_blank")
                }
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <QrCode className="h-3 w-3" /> QR Sheets
              </button>
              <button
                onClick={() => {
                  setEditMatchingMethod(event.matchingMethod || "sequence");
                  setEditing(!editing);
                }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" /> Edit Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Form */}
      {editing && event && (
        <Card className="mb-4">
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
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Import Roster */}
      {showImport && event && (
        <EventRosterImport
          eventId={eventId}
          schoolId={event.school.id}
          onDone={() => {
            setShowImport(false);
            fetchEvent();
          }}
          onCancel={() => setShowImport(false)}
        />
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b mb-6">
        {tabs.map((tab) => {
          const isActive =
            tab.href === base ? pathname === base : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}

      {/* Shot List */}
      {showShotList && event && (
        <ShotList
          classOrder={classOrder}
          studentsByClass={studentsByClass}
          schoolName={event.school.name}
          date={new Date(event.date)}
          onClose={() => setShowShotList(false)}
        />
      )}
    </div>
    </EventContext.Provider>
  );
}

// ─── EventRosterImport ────────────────────────────────

interface CsvRow {
  [key: string]: string;
}

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
  const [mode, setMode] = useState<
    "choose" | "csv-map" | "csv-preview" | "warn" | "result"
  >("choose");
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [warning, setWarning] = useState<{
    checkInCount: number;
    message: string;
  } | null>(null);
  const [result, setResult] = useState<{
    created?: number;
    updated?: number;
    enrolled: number;
    errors?: { row: number; message: string }[];
    total?: number;
    alreadyEnrolled?: number;
  } | null>(null);
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
    setResult({
      enrolled: data.enrolled,
      alreadyEnrolled: data.alreadyEnrolled,
      total: data.total,
    });
    setMode("result");
  }

  void schoolId;

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
            if (field.key === "firstName")
              return lower.includes("first") || lower === "firstname";
            if (field.key === "lastName")
              return lower.includes("last") || lower === "lastname";
            if (field.key === "grade")
              return lower.includes("grade") || lower.includes("level");
            if (field.key === "teacher")
              return lower.includes("teacher") || lower.includes("class");
            if (field.key === "studentId")
              return lower.includes("studentid") || lower === "id";
            if (field.key === "parentEmail")
              return lower.includes("email") || lower.includes("parent");
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
    <Card className="mb-4">
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
                    Enroll all students already in the school. Assign grades &amp; teachers
                    after.
                  </p>
                </div>
                {loading && (
                  <span className="text-xs text-muted-foreground">Enrolling…</span>
                )}
              </button>
              <label className="flex flex-col items-center gap-2 rounded-lg border-2 border-input hover:border-primary hover:bg-muted/30 p-4 text-left transition-colors cursor-pointer">
                <Upload className="h-7 w-7 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Upload CSV</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Import from a roster file. Grade and teacher are set from the CSV.
                  </p>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  className="sr-only"
                  onChange={handleFileSelect}
                />
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
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm flex-1"
                  >
                    <option value="">— Skip —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setMode("choose")}>
                Back
              </Button>
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
                  {getMappedStudents()
                    .slice(0, 5)
                    .map((s, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">
                          {s.firstName} {s.lastName}
                        </td>
                        <td className="px-3 py-2">{s.grade}</td>
                        <td className="px-3 py-2">{s.teacher || "—"}</td>
                        <td className="px-3 py-2">{s.studentId || "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setMode("csv-map")}>
                Back
              </Button>
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
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
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
                Enrolled {result.enrolled} new student
                {result.enrolled !== 1 ? "s" : ""}
                {result.alreadyEnrolled > 0
                  ? ` (${result.alreadyEnrolled} already enrolled)`
                  : ""}
                {result.enrolled > 0 && " Assign grades and teachers in the roster below."}
              </p>
            ) : (
              <p className="text-sm font-medium text-green-700 mb-1">
                Enrolled {result.enrolled} of {result.total} students
                {result.created && result.created > 0 ? ` (${result.created} new)` : ""}
                {result.updated && result.updated > 0
                  ? `, ${result.updated} updated`
                  : ""}
                .
              </p>
            )}
            {result.errors && result.errors.length > 0 && (
              <ul className="text-sm text-destructive space-y-1 mt-2 max-h-32 overflow-auto">
                {result.errors.map((err, i) => (
                  <li key={i}>
                    Row {err.row}: {err.message}
                  </li>
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

// ─── ShotList ─────────────────────────────────────────

function gradeLabel(grade: string) {
  return grade ? `Grade ${grade}` : "Unassigned";
}

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
        @media print { body { padding: 0; } }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Shot List</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5 mr-1" /> Print
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={printRef}>
          <h1>{schoolName} — Picture Day Shot List</h1>
          <p className="meta">
            {date.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
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
