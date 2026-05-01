"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useEvent } from "../event-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Camera,
  UserX,
  RotateCcw,
  Search,
  QrCode,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Clock,
  Undo2,
  Lock,
} from "lucide-react";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  teacher: string | null;
  studentId: string | null;
}

interface CheckIn {
  id: string;
  status: string;
  sequence: number | null;
  notes: string | null;
  checkedInAt: string | null;
  studentId: string;
  student: Student;
}

interface Stats {
  total: number;
  pending: number;
  photographed: number;
  absent: number;
  retake: number;
  done: number;
  remaining: number;
}

interface ClassGroup {
  grade: string;
  teacher: string;
  students: StudentWithStatus[];
}

interface StudentWithStatus extends Student {
  checkInStatus: string;
  checkInId?: string;
  sequence?: number | null;
  checkedInAt?: string | null;
}

interface CheckInLogEntry {
  id: string;
  action: string;
  sequence: number | null;
  timestamp: string;
  student: Student;
}

export default function ShootDayPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const { event, refreshEvent } = useEvent();

  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showWalkUp, setShowWalkUp] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithStatus | null>(null);
  const [showShootLog, setShowShootLog] = useState(true);
  const [shootLogEntries, setShootLogEntries] = useState<CheckInLogEntry[]>([]);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/checkins`);
    const data = await res.json();
    setCheckIns(data.checkIns || []);
    setAllStudents(data.allStudents || []);
    setStats(data.stats || null);
    setShootLogEntries(data.logs || []);
    setInitialized(data.checkIns?.length > 0);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function initializeShoot() {
    await fetch(`/api/events/${eventId}/checkins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "init" }),
    });
    fetchData();
    refreshEvent();
  }

  const shootLocked =
    event?.status === "post_shoot" || event?.status === "completed";

  async function updateStatus(studentId: string, status: string) {
    await fetch(`/api/events/${eventId}/checkins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, status }),
    });
    fetchData();
  }

  // Build class groups with check-in status
  const checkInMap = new Map(checkIns.map((ci) => [ci.studentId, ci]));

  const studentsWithStatus: StudentWithStatus[] = allStudents.map((s) => {
    const ci = checkInMap.get(s.id);
    return {
      ...s,
      checkInStatus: ci?.status || "pending",
      checkInId: ci?.id,
      sequence: ci?.sequence,
      checkedInAt: ci?.checkedInAt || null,
    };
  });

  // Filter by search
  const filtered = search
    ? studentsWithStatus.filter(
        (s) =>
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
          s.studentId?.toLowerCase().includes(search.toLowerCase())
      )
    : studentsWithStatus;

  // Group by class
  const classGroups: ClassGroup[] = [];
  const groupMap = new Map<string, StudentWithStatus[]>();
  for (const s of filtered) {
    const key = `${s.grade}|${s.teacher || "Unassigned"}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(s);
  }
  for (const [key, students] of Array.from(groupMap.entries())) {
    const [grade, teacher] = key.split("|");
    classGroups.push({
      grade,
      teacher,
      students: students.sort((a, b) => a.lastName.localeCompare(b.lastName)),
    });
  }
  classGroups.sort((a, b) => a.grade.localeCompare(b.grade));

  // Elapsed time calculation from log entries
  const elapsed = (() => {
    if (shootLogEntries.length < 2) return null;
    const first = new Date(shootLogEntries[0].timestamp).getTime();
    const last = new Date(shootLogEntries[shootLogEntries.length - 1].timestamp).getTime();
    const diffMs = last - first;
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    if (hrs > 0) return `${hrs}h ${remainMins}m elapsed`;
    return `${mins}m elapsed`;
  })();

  const isQrMode = event?.matchingMethod === "qr";

  if (loading || !event) return <p className="p-4 text-muted-foreground">Loading...</p>;

  return (
    <div className="max-w-2xl mx-auto">

      {/* Progress Bar */}
      {stats && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">
                {stats.photographed} of {stats.total} photographed
              </span>
              <span className="text-muted-foreground">
                {stats.absent} absent &middot; {stats.retake} retake
              </span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all rounded-full"
                style={{
                  width: `${stats.total > 0 ? (stats.photographed / stats.total) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" /> Done: {stats.photographed}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/30" /> Pending: {stats.pending}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400" /> Absent: {stats.absent}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-400" /> Retake: {stats.retake}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Initialize or Controls */}
      {!initialized ? (
        <Card className="mb-4">
          <CardContent className="p-6 text-center">
            <Camera className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">Ready to Start?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Initialize the shoot to create check-in records for all {allStudents.length} students.
            </p>
            <Button onClick={initializeShoot} size="lg">
              Start Shoot
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Shoot Log */}
          <ShootLog
            entries={shootLogEntries}
            photographed={stats?.photographed || 0}
            total={stats?.total || 0}
            elapsed={elapsed}
            expanded={showShootLog}
            onToggle={() => setShowShootLog(!showShootLog)}
          />

          {/* Locked notice */}
          {shootLocked && (
            <div className="flex items-center gap-2 rounded-md border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground mb-4">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              Shoot day is complete. Check-ins are read-only. Use &ldquo;← Re-open Shoot Day&rdquo; in the Next Step bar to make changes.
            </div>
          )}

          {/* Action Bar */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {!shootLocked && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowScanner(!showScanner)}
                  title="Scan QR/Barcode"
                >
                  <QrCode className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowWalkUp(!showWalkUp)}
                  title="Add Walk-up Student"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          {/* Scanner */}
          {showScanner && (
            <ScannerCard
              onScan={(code) => {
                // Find student by studentId
                const student = allStudents.find((s) => s.studentId === code);
                if (student) {
                  updateStatus(student.id, "photographed");
                  setShowScanner(false);
                } else {
                  alert(`No student found with ID: ${code}`);
                }
              }}
              onClose={() => setShowScanner(false)}
            />
          )}

          {/* Walk-up */}
          {showWalkUp && (
            <WalkUpForm
              eventId={eventId}
              isQrMode={isQrMode}
              onAdded={(student) => {
                setShowWalkUp(false);
                fetchData().then(() => {
                  if (isQrMode && student) {
                    setSelectedStudent(student);
                  }
                });
              }}
              onCancel={() => setShowWalkUp(false)}
            />
          )}

          {/* Class Groups */}
          {classGroups.map((group) => {
            const key = `${group.grade}|${group.teacher}`;
            const isExpanded = expandedClass === key || expandedClass === null;
            const groupDone = group.students.filter((s) => s.checkInStatus === "photographed").length;

            return (
              <div key={key} className="mb-3">
                <button
                  onClick={() =>
                    setExpandedClass(expandedClass === key ? null : key)
                  }
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-sm font-medium"
                >
                  <span>
                    Grade {group.grade} — {group.teacher}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {groupDone}/{group.students.length}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </span>
                </button>

                {isExpanded && (
                  <div className="mt-1 space-y-1">
                    {group.students.map((student) => (
                      <StudentCard
                        key={student.id}
                        student={student}
                        locked={shootLocked}
                        onUpdateStatus={(status) =>
                          updateStatus(student.id, status)
                        }
                        onShowQR={
                          isQrMode && !shootLocked
                            ? (s) => setSelectedStudent(s)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Full-screen QR overlay */}
      {selectedStudent && (
        <QRFullScreenOverlay
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onMarkPhotographed={() => {
            updateStatus(selectedStudent.id, "photographed");
            setSelectedStudent(null);
          }}
          onMarkAbsent={() => {
            updateStatus(selectedStudent.id, "absent");
            setSelectedStudent(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Full-Screen QR Overlay ──────────────────────────

function QRFullScreenOverlay({
  student,
  onClose,
  onMarkPhotographed,
  onMarkAbsent,
}: {
  student: StudentWithStatus;
  onClose: () => void;
  onMarkPhotographed: () => void;
  onMarkAbsent: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Generate QR on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const url = await QRCode.toDataURL(`SPH:${student.id}`, {
          width: 400,
          margin: 2,
          errorCorrectionLevel: "H",
        });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        // QR generation failed
      }
    })();
    return () => { cancelled = true; };
  }, [student.id]);

  // Escape key to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white"
      >
        <X className="h-8 w-8" />
      </button>

      {/* Student info + QR */}
      <div className="flex flex-col items-center gap-4">
        <p className="text-4xl font-bold text-white">
          {student.firstName} {student.lastName}
        </p>
        <p className="text-lg text-white/70">
          Grade {student.grade}
          {student.teacher ? ` — ${student.teacher}` : ""}
        </p>

        {/* QR Code */}
        <div className="bg-white p-4 rounded-2xl">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-72 h-72" />
          ) : (
            <div className="w-72 h-72 flex items-center justify-center">
              <QrCode className="h-16 w-16 text-gray-300 animate-pulse" />
            </div>
          )}
        </div>

        {student.studentId && (
          <p className="text-sm text-white/50 font-mono">{student.studentId}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 mt-8">
        <Button
          size="lg"
          className="bg-green-600 hover:bg-green-700 text-white px-8 text-lg"
          onClick={onMarkPhotographed}
        >
          <Camera className="h-5 w-5 mr-2" /> Done
        </Button>
        <button
          className="inline-flex items-center justify-center h-11 rounded-md px-8 text-lg font-medium border border-white/30 text-white hover:bg-white/10 transition-colors"
          onClick={onMarkAbsent}
        >
          <UserX className="h-5 w-5 mr-2" /> Absent
        </button>
      </div>
    </div>
  );
}

// ─── Shoot Log ───────────────────────────────────────

function ShootLog({
  entries,
  photographed,
  total,
  elapsed,
  expanded,
  onToggle,
}: {
  entries: CheckInLogEntry[];
  photographed: number;
  total: number;
  elapsed: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length, expanded]);

  const actionDot: Record<string, string> = {
    photographed: "bg-green-500",
    absent: "bg-red-400",
    retake: "bg-yellow-400",
    pending: "bg-gray-400",
  };

  const actionLabel: Record<string, string> = {
    photographed: "",
    absent: "absent",
    retake: "retake",
    pending: "reset",
  };

  return (
    <Card className="mb-4">
      <CardContent className="p-0">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 rounded-t-lg"
        >
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Shoot Log
            <span className="text-xs font-normal text-muted-foreground">
              {photographed} of {total} done
              {entries.length !== photographed && ` · ${entries.length} actions`}
            </span>
            {elapsed && (
              <span className="text-xs font-normal text-muted-foreground">
                &middot; {elapsed}
              </span>
            )}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div
            ref={scrollRef}
            className="max-h-64 overflow-y-auto border-t"
          >
            {entries.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No activity yet. Mark students as photographed to see the shoot log.
              </p>
            ) : (
              <div className="divide-y">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-4 py-2 text-sm"
                  >
                    {/* Sequence badge */}
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {entry.sequence || "—"}
                    </span>

                    {/* Action dot */}
                    <span
                      className={`flex-shrink-0 w-2 h-2 rounded-full ${
                        actionDot[entry.action] || "bg-muted-foreground/30"
                      }`}
                    />

                    {/* Name + info */}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">
                        {entry.student.lastName}, {entry.student.firstName}
                      </span>
                      {actionLabel[entry.action] && (
                        <span className="ml-1.5 text-xs text-muted-foreground italic">
                          ({actionLabel[entry.action]})
                        </span>
                      )}
                      <span className="ml-2 text-xs text-muted-foreground">
                        Gr {entry.student.grade}{entry.student.teacher ? ` — ${entry.student.teacher}` : ""}
                      </span>
                    </div>

                    {/* Timestamp */}
                    <span className="flex-shrink-0 text-xs text-muted-foreground font-mono">
                      {new Date(entry.timestamp).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Student Card ─────────────────────────────────────

function StudentCard({
  student,
  locked,
  onUpdateStatus,
  onShowQR,
}: {
  student: StudentWithStatus;
  locked?: boolean;
  onUpdateStatus: (status: string) => void;
  onShowQR?: (student: StudentWithStatus) => void;
}) {
  const statusStyles: Record<string, string> = {
    pending: "border-l-muted-foreground/30",
    photographed: "border-l-green-500 bg-green-50",
    absent: "border-l-red-400 bg-red-50",
    retake: "border-l-yellow-400 bg-yellow-50",
  };

  const isTappable = onShowQR && (student.checkInStatus === "pending" || student.checkInStatus === "retake");

  return (
    <div
      className={`flex items-center gap-3 rounded-md border border-l-4 px-3 py-2 ${
        statusStyles[student.checkInStatus] || ""
      }`}
    >
      <div
        className={`flex-1 min-w-0 ${isTappable ? "cursor-pointer" : ""}`}
        onClick={isTappable ? () => onShowQR!(student) : undefined}
      >
        <p className="text-sm font-medium truncate">
          {isTappable && (
            <QrCode className="inline h-3.5 w-3.5 mr-1.5 text-primary" />
          )}
          {student.lastName}, {student.firstName}
          {student.sequence && (
            <span className="ml-2 text-xs text-muted-foreground">#{student.sequence}</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {student.studentId || "No ID"}
        </p>
      </div>
      {!locked && (
        <div className="flex gap-1">
          <button
            onClick={() => onUpdateStatus("photographed")}
            className={`p-2 rounded-md transition-colors ${
              student.checkInStatus === "photographed"
                ? "bg-green-500 text-white"
                : "text-muted-foreground hover:bg-green-100 hover:text-green-700"
            }`}
            title="Photographed"
          >
            <Camera className="h-4 w-4" />
          </button>
          <button
            onClick={() => onUpdateStatus("absent")}
            className={`p-2 rounded-md transition-colors ${
              student.checkInStatus === "absent"
                ? "bg-red-400 text-white"
                : "text-muted-foreground hover:bg-red-100 hover:text-red-600"
            }`}
            title="Absent"
          >
            <UserX className="h-4 w-4" />
          </button>
          <button
            onClick={() => onUpdateStatus("retake")}
            className={`p-2 rounded-md transition-colors ${
              student.checkInStatus === "retake"
                ? "bg-yellow-400 text-white"
                : "text-muted-foreground hover:bg-yellow-100 hover:text-yellow-600"
            }`}
            title="Flag for Retake"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          {student.checkInStatus !== "pending" && (
            <button
              onClick={() => {
                if (window.confirm(`Reset ${student.firstName} ${student.lastName} to pending? This will remove them from the shoot log.`)) {
                  onUpdateStatus("pending");
                }
              }}
              className="p-2 rounded-md text-muted-foreground hover:bg-orange-100 hover:text-orange-600"
              title="Reset to Pending"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── QR/Barcode Scanner ───────────────────────────────

function ScannerCard({
  onScan,
  onClose,
}: {
  onScan: (code: string) => void;
  onClose: () => void;
}) {
  const [manualCode, setManualCode] = useState("");

  // For the scanner, we use a manual entry fallback
  // The html5-qrcode integration would go here in production
  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode("");
    }
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <QrCode className="h-4 w-4" /> Scan / Enter Student ID
          </h3>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="bg-muted/50 rounded-lg p-8 text-center mb-3 border-2 border-dashed">
          <QrCode className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Camera scanner available when html5-qrcode is configured.
            <br />
            Use manual entry below.
          </p>
        </div>

        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <Input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Enter student ID..."
            autoFocus
          />
          <Button type="submit" size="sm">
            <Check className="h-4 w-4 mr-1" /> Check In
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Walk-Up Student Form ─────────────────────────────

function WalkUpForm({
  eventId,
  isQrMode,
  onAdded,
  onCancel,
}: {
  eventId: string;
  isQrMode: boolean;
  onAdded: (student?: StudentWithStatus) => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);

    // First get the event to find the school
    const eventRes = await fetch(`/api/events/${eventId}`);
    const eventData = await eventRes.json();
    const schoolId = eventData.event?.school?.id;

    if (!schoolId) {
      setError("Could not find school");
      setLoading(false);
      return;
    }

    const firstName = fd.get("firstName") as string;
    const lastName = fd.get("lastName") as string;
    const grade = fd.get("grade") as string;
    const teacher = fd.get("teacher") as string;

    // Auto-generate a walk-up student ID (WU-001, WU-002, etc.)
    const studentsRes = await fetch(`/api/schools/${schoolId}/students?search=WU-`);
    const studentsData = await studentsRes.json();
    const existingWU = (studentsData.students || [])
      .map((s: Student) => s.studentId)
      .filter((id: string | null) => id && /^WU-\d+$/.test(id))
      .map((id: string) => parseInt(id.replace("WU-", ""), 10));
    const nextNum = existingWU.length > 0 ? Math.max(...existingWU) + 1 : 1;
    const walkUpId = `WU-${String(nextNum).padStart(3, "0")}`;

    // Create the student (identity only — no grade/teacher on master record)
    const studentRes = await fetch(`/api/schools/${schoolId}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, studentId: walkUpId }),
    });

    if (!studentRes.ok) {
      const data = await studentRes.json();
      setError(data.error || "Failed to add student");
      setLoading(false);
      return;
    }

    const { student } = await studentRes.json();

    // Create enrollment for this event with grade/teacher
    await fetch(`/api/events/${eventId}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: student.id, grade, teacher }),
    });

    if (isQrMode) {
      // In QR mode: create check-in as pending, then show QR overlay
      await fetch(`/api/events/${eventId}/checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, status: "pending" }),
      });

      setLoading(false);
      onAdded({
        ...student,
        grade,
        teacher,
        checkInStatus: "pending",
      } as StudentWithStatus);
    } else {
      // Non-QR mode: mark as photographed immediately
      await fetch(`/api/events/${eventId}/checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, status: "photographed" }),
      });

      setLoading(false);
      onAdded();
    }
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Add Walk-Up Student
        </h3>
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 mb-3">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input name="firstName" placeholder="First name *" required />
            <Input name="lastName" placeholder="Last name *" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input name="grade" placeholder="Grade *" required />
            <Input name="teacher" placeholder="Teacher" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Adding..." : isQrMode ? "Add & Show QR" : "Add & Photograph"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
