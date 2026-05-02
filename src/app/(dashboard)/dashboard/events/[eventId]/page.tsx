"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useEvent, type Student, type ClassGroup } from "./event-context";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
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
  GripVertical,
  Users,
  Camera,
  ShoppingCart,
  Pencil,
  Save,
  X,
  Check,
  Plus,
  Lock,
  UserPlus,
} from "lucide-react";

function gradeLabel(grade: string) {
  return grade ? `Grade ${grade}` : "Unassigned";
}

function gradeKey(grade: string, teacher: string | null) {
  return `${grade || ""}|${teacher || "Unassigned"}`;
}

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const { event, classOrder, setClassOrder, refreshEvent } = useEvent();
  const [saving, setSaving] = useState(false);

  async function saveClassOrder() {
    setSaving(true);
    await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classOrder }),
    });
    setSaving(false);
    refreshEvent();
  }

  if (!event) return <p className="text-muted-foreground">Loading...</p>;

  const locked = event._count.checkIns > 0;

  const studentsByClass = new Map<string, Student[]>();
  for (const s of event.school.students) {
    const key = gradeKey(s.grade, s.teacher);
    if (!studentsByClass.has(key)) studentsByClass.set(key, []);
    studentsByClass.get(key)!.push(s);
  }

  return (
    <div>
      {/* Stats */}
      <div className="flex gap-6 mb-4 text-sm">
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

      {locked && (
        <div className="flex items-center gap-2 rounded-md border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground mb-4">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Roster and class assignments are locked once check-ins begin to prevent data inconsistencies.
        </div>
      )}

      {/* Roster Board */}
      <RosterBoard
        eventId={eventId}
        students={event.school.students}
        onRefresh={refreshEvent}
        locked={locked}
        onGroupAdded={(grade, teacher) => {
          const key = gradeKey(grade, teacher);
          if (!classOrder.find((c) => gradeKey(c.grade, c.teacher) === key)) {
            setClassOrder([...classOrder, { grade, teacher }]);
          }
        }}
      />

      {/* Class Shooting Order */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Class Shooting Order</CardTitle>
            {!locked && (
              <Button size="sm" variant="outline" onClick={saveClassOrder} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1" />
                {saving ? "Saving..." : "Save Order"}
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {locked
              ? "Shooting order at time of picture day."
              : "Drag to reorder. This determines the order classes will be photographed."}
          </p>
        </CardHeader>
        <CardContent>
          <ClassOrderList
            classOrder={classOrder}
            setClassOrder={setClassOrder}
            studentsByClass={studentsByClass}
            locked={locked}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Roster Board ─────────────────────────────────────

type GroupDef = { grade: string; teacher: string };
type PendingRemove = { studentId: string; name: string; message: string };
type SearchResult = { id: string; firstName: string; lastName: string; studentId: string | null };

function boardGroupId(grade: string, teacher: string | null) {
  return `${grade}|${teacher ?? ""}`;
}

function RosterBoard({
  eventId,
  students,
  onRefresh,
  locked = false,
  onGroupAdded,
}: {
  eventId: string;
  students: Student[];
  onRefresh: () => void;
  locked?: boolean;
  onGroupAdded?: (grade: string, teacher: string) => void;
}) {
  const [localStudents, setLocalStudents] = useState<Student[]>(students);
  const [emptyGroups, setEmptyGroups] = useState<GroupDef[]>([]);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [newGrade, setNewGrade] = useState("");
  const [newTeacher, setNewTeacher] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGrade, setEditGrade] = useState("");
  const [editTeacher, setEditTeacher] = useState("");
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    setLocalStudents(students);
  }, [students]);

  const derivedGroups = useMemo(() => {
    const seen = new Map<string, GroupDef>();
    for (const s of localStudents) {
      if (!s.grade && !s.teacher) continue;
      const id = boardGroupId(s.grade, s.teacher);
      if (!seen.has(id)) seen.set(id, { grade: s.grade, teacher: s.teacher ?? "" });
    }
    return Array.from(seen.values()).sort((a, b) => a.grade.localeCompare(b.grade));
  }, [localStudents]);

  const allGroups = useMemo(() => {
    const derivedIds = new Set(derivedGroups.map((g) => boardGroupId(g.grade, g.teacher)));
    const extras = emptyGroups.filter(
      (g) => !derivedIds.has(boardGroupId(g.grade, g.teacher))
    );
    return [...derivedGroups, ...extras];
  }, [derivedGroups, emptyGroups]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(e: DragStartEvent) {
    const s = localStudents.find((s) => s.id === e.active.id);
    if (s) setActiveStudent(s);
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveStudent(null);
    const { active, over } = e;
    if (!over) return;
    const studentId = active.id as string;
    const targetId = over.id as string;
    const student = localStudents.find((s) => s.id === studentId);
    if (!student) return;
    if (boardGroupId(student.grade, student.teacher) === targetId) return;

    let grade = "";
    let teacher = "";
    if (targetId !== "unassigned") {
      [grade, teacher] = targetId.split("|");
    }

    setLocalStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, grade, teacher } : s))
    );
    fetch(`/api/events/${eventId}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, grade, teacher }),
    });
  }

  function addGroup() {
    if (!newGrade && !newTeacher) return;
    const id = boardGroupId(newGrade, newTeacher);
    if (!allGroups.find((g) => boardGroupId(g.grade, g.teacher) === id)) {
      setEmptyGroups((prev) => [...prev, { grade: newGrade, teacher: newTeacher }]);
      onGroupAdded?.(newGrade, newTeacher);
    }
    setNewGrade("");
    setNewTeacher("");
    setAddingGroup(false);
  }

  async function handleSaveGroupEdit(oldGroup: GroupDef) {
    const affected = localStudents.filter(
      (s) => s.grade === oldGroup.grade && (s.teacher ?? "") === oldGroup.teacher
    );
    setLocalStudents((prev) =>
      prev.map((s) =>
        s.grade === oldGroup.grade && (s.teacher ?? "") === oldGroup.teacher
          ? { ...s, grade: editGrade, teacher: editTeacher }
          : s
      )
    );
    setEditingGroupId(null);
    await Promise.all(
      affected.map((s) =>
        fetch(`/api/events/${eventId}/enrollments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: s.id, grade: editGrade, teacher: editTeacher }),
        })
      )
    );
    onRefresh();
  }

  async function handleDeleteGroup(group: GroupDef) {
    const affected = localStudents.filter(
      (s) => s.grade === group.grade && (s.teacher ?? "") === group.teacher
    );
    setLocalStudents((prev) =>
      prev.map((s) =>
        s.grade === group.grade && (s.teacher ?? "") === group.teacher
          ? { ...s, grade: "", teacher: null }
          : s
      )
    );
    setEmptyGroups((prev) =>
      prev.filter((g) => !(g.grade === group.grade && g.teacher === group.teacher))
    );
    await Promise.all(
      affected.map((s) =>
        fetch(`/api/events/${eventId}/enrollments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: s.id, grade: "", teacher: "" }),
        })
      )
    );
    onRefresh();
  }

  async function removeStudent(studentId: string, name: string) {
    setRemoveError(null);
    const res = await fetch(`/api/events/${eventId}/enrollments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    if (res.ok) {
      setLocalStudents((prev) => prev.filter((s) => s.id !== studentId));
      onRefresh();
      return;
    }
    const data = await res.json();
    if (data.hasOrders) {
      setRemoveError(data.error);
      return;
    }
    if (data.warning) {
      setPendingRemove({ studentId, name, message: data.message });
      return;
    }
    setRemoveError(data.error ?? "Failed to remove student.");
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    const { studentId } = pendingRemove;
    const res = await fetch(`/api/events/${eventId}/enrollments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, confirm: true }),
    });
    if (res.ok) {
      setPendingRemove(null);
      setLocalStudents((prev) => prev.filter((s) => s.id !== studentId));
      onRefresh();
      return;
    }
    const data = await res.json();
    setPendingRemove(null);
    setRemoveError(data.error ?? "Failed to remove student.");
  }

  const unassigned = localStudents.filter((s) => !s.grade && !s.teacher);

  return (
    <Card id="roster-board" className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Event Roster</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {localStudents.length} students{!locked && " — drag to assign to a group"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddingStudent(true)}
              disabled={addingStudent}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Student
            </Button>
            {!locked && (
              <Button size="sm" variant="outline" onClick={() => setAddingGroup(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Class
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {addingStudent && (
          <AddStudentPanel
            eventId={eventId}
            onClose={() => setAddingStudent(false)}
            onEnrolled={() => {
              setAddingStudent(false);
              onRefresh();
            }}
          />
        )}

        {pendingRemove && (
          <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
            <p className="text-sm text-amber-800 dark:text-amber-200">{pendingRemove.message}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={confirmRemove}>
                Remove Anyway
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPendingRemove(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {removeError && (
          <div className="flex items-start justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            <p className="text-sm text-destructive">{removeError}</p>
            <button
              onClick={() => setRemoveError(null)}
              className="ml-2 text-destructive/60 hover:text-destructive shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <DndContext
          sensors={locked ? [] : sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <GroupBucket
            id="unassigned"
            label="Unassigned"
            students={unassigned}
            isUnassigned
            locked={locked}
            onRemoveStudent={removeStudent}
          />

          {allGroups.map((group) => {
            const id = boardGroupId(group.grade, group.teacher);
            const gs = localStudents.filter(
              (s) => s.grade === group.grade && (s.teacher ?? "") === group.teacher
            );
            const isEditing = !locked && editingGroupId === id;
            return (
              <GroupBucket
                key={id}
                id={id}
                label={`Grade ${group.grade}${group.teacher ? ` — ${group.teacher}` : ""}`}
                students={gs}
                locked={locked}
                isEditing={isEditing}
                editGrade={editGrade}
                editTeacher={editTeacher}
                onStartEdit={() => {
                  setEditingGroupId(id);
                  setEditGrade(group.grade);
                  setEditTeacher(group.teacher);
                }}
                onSaveEdit={() => handleSaveGroupEdit(group)}
                onCancelEdit={() => setEditingGroupId(null)}
                onEditGrade={setEditGrade}
                onEditTeacher={setEditTeacher}
                onDelete={() => handleDeleteGroup(group)}
                onRemoveStudent={removeStudent}
              />
            );
          })}

          {addingGroup && (
            <div className="flex items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-3">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-muted-foreground">Grade</span>
                <input
                  value={newGrade}
                  onChange={(e) => setNewGrade(e.target.value)}
                  placeholder="4"
                  className="h-7 w-14 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && addGroup()}
                />
              </div>
              <span className="text-muted-foreground text-sm shrink-0">—</span>
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-xs text-muted-foreground shrink-0">Teacher</span>
                <input
                  value={newTeacher}
                  onChange={(e) => setNewTeacher(e.target.value)}
                  placeholder="Mrs. Smith"
                  className="h-7 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  onKeyDown={(e) => e.key === "Enter" && addGroup()}
                />
              </div>
              <Button size="sm" className="h-8 shrink-0" onClick={addGroup}>
                Add Class
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 shrink-0"
                onClick={() => setAddingGroup(false)}
              >
                Cancel
              </Button>
            </div>
          )}

          <DragOverlay>
            {activeStudent && (
              <div className="flex items-center gap-1.5 rounded-md border bg-background shadow-md px-2.5 py-1.5 text-xs font-medium cursor-grabbing">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                {activeStudent.lastName}, {activeStudent.firstName}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
}

function GroupBucket({
  id,
  label,
  students,
  isUnassigned = false,
  locked = false,
  isEditing = false,
  editGrade = "",
  editTeacher = "",
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditGrade,
  onEditTeacher,
  onDelete,
  onRemoveStudent,
}: {
  id: string;
  label: string;
  students: Student[];
  isUnassigned?: boolean;
  locked?: boolean;
  isEditing?: boolean;
  editGrade?: string;
  editTeacher?: string;
  onStartEdit?: () => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  onEditGrade?: (v: string) => void;
  onEditTeacher?: (v: string) => void;
  onDelete?: () => void;
  onRemoveStudent?: (studentId: string, name: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="rounded-lg border overflow-hidden">
      <div
        className={`flex items-center gap-2 px-3 py-2 border-b ${
          isUnassigned ? "bg-muted/20" : "bg-muted/50"
        }`}
      >
        {isEditing ? (
          <>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-muted-foreground">Grade</span>
              <input
                value={editGrade}
                onChange={(e) => onEditGrade?.(e.target.value)}
                placeholder="4"
                className="h-7 w-14 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
            </div>
            <span className="text-muted-foreground text-sm shrink-0">—</span>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-xs text-muted-foreground shrink-0">Teacher</span>
              <input
                value={editTeacher}
                onChange={(e) => onEditTeacher?.(e.target.value)}
                placeholder="Mrs. Smith"
                className="h-7 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <Button size="sm" className="h-7 px-2 shrink-0" onClick={onSaveEdit}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={onCancelEdit}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold flex-1">{label}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{students.length}</span>
            {!isUnassigned && !locked && (
              <>
                <button
                  onClick={onStartEdit}
                  className="p-0.5 text-muted-foreground hover:text-foreground rounded"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-0.5 text-muted-foreground hover:text-destructive rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </>
        )}
      </div>
      <div
        ref={locked ? undefined : setNodeRef}
        className={`min-h-[52px] p-2 flex flex-wrap gap-1.5 transition-colors ${
          !locked && isOver ? "bg-primary/5 ring-1 ring-inset ring-primary" : "bg-background"
        }`}
      >
        {students
          .slice()
          .sort((a, b) => a.lastName.localeCompare(b.lastName))
          .map((s) =>
            locked ? (
              <StudentChip key={s.id} student={s} />
            ) : (
              <DraggableStudentChip
                key={s.id}
                student={s}
                onRemove={() => onRemoveStudent?.(s.id, `${s.firstName} ${s.lastName}`)}
              />
            )
          )}
        {students.length === 0 && !locked && (
          <p className="text-xs text-muted-foreground/50 italic self-center px-1">
            Drop students here
          </p>
        )}
      </div>
    </div>
  );
}

function DraggableStudentChip({
  student,
  onRemove,
}: {
  student: Student;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: student.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      {...attributes}
      {...listeners}
      className={`flex items-center gap-1 rounded border bg-card px-2 py-1 text-xs select-none touch-none cursor-grab transition-colors ${
        isDragging ? "opacity-30" : "hover:border-primary hover:bg-muted/40"
      }`}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground/50 shrink-0" />
      <span className="font-medium">
        {student.lastName}, {student.firstName}
      </span>
      {student.studentId && (
        <span className="text-muted-foreground">· {student.studentId}</span>
      )}
      {onRemove && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 p-0.5 text-muted-foreground/50 hover:text-destructive rounded transition-colors"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

function StudentChip({ student }: { student: Student }) {
  return (
    <div className="flex items-center gap-1 rounded border bg-card px-2 py-1 text-xs">
      <span className="font-medium">
        {student.lastName}, {student.firstName}
      </span>
      {student.studentId && (
        <span className="text-muted-foreground">· {student.studentId}</span>
      )}
    </div>
  );
}

// ─── Add Student Panel ────────────────────────────────

function AddStudentPanel({
  eventId,
  onClose,
  onEnrolled,
}: {
  eventId: string;
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [alreadyEnrolled, setAlreadyEnrolled] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createStudentId, setCreateStudentId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (search.length < 1) {
      setResults([]);
      setAlreadyEnrolled([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const res = await fetch(
        `/api/events/${eventId}/enrollments?search=${encodeURIComponent(search)}`
      );
      const data = await res.json();
      setResults(data.students ?? []);
      setAlreadyEnrolled(data.alreadyEnrolled ?? []);
      setSearching(false);
    }, 300);
    return () => {
      clearTimeout(timer);
      setSearching(false);
    };
  }, [search, eventId]);

  async function enrollStudent(studentId: string) {
    setEnrolling(studentId);
    const res = await fetch(`/api/events/${eventId}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, grade: "", teacher: "" }),
    });
    setEnrolling(null);
    if (res.ok) {
      onEnrolled();
    }
  }

  async function createAndEnroll() {
    if (!createFirstName.trim() || !createLastName.trim()) {
      setError("First name and last name are required.");
      return;
    }
    setCreating(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        firstName: createFirstName.trim(),
        lastName: createLastName.trim(),
        studentId: createStudentId.trim() || undefined,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (res.ok) {
      onEnrolled();
      return;
    }
    if (data.alreadyEnrolled) {
      setError(data.error);
      return;
    }
    if (data.exists) {
      // Surface the existing student in search results
      setSearch(`${data.existingStudent.firstName} ${data.existingStudent.lastName}`);
      setError(
        `Already in this school's roster — search results updated. Use "Enroll" to add them.`
      );
      return;
    }
    setError(data.error ?? "Failed to create student.");
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Add Student</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search school roster */}
      <div>
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search school roster by name or ID…"
            autoFocus
            className="h-8 w-full rounded-md border border-input bg-background pl-3 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {searching && (
            <div className="absolute right-2.5 top-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </div>

        {results.length > 0 && (
          <div className="mt-2 space-y-1">
            {results.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md border bg-background px-3 py-1.5"
              >
                <span className="text-sm">
                  {s.lastName}, {s.firstName}
                  {s.studentId && (
                    <span className="text-muted-foreground ml-1.5">· {s.studentId}</span>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  disabled={enrolling === s.id}
                  onClick={() => enrollStudent(s.id)}
                >
                  {enrolling === s.id ? "Enrolling…" : "Enroll"}
                </Button>
              </div>
            ))}
          </div>
        )}

        {alreadyEnrolled.length > 0 && (
          <div className="mt-2 space-y-1">
            {alreadyEnrolled.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-1.5 opacity-60"
              >
                <span className="text-sm">
                  {s.lastName}, {s.firstName}
                  {s.studentId && (
                    <span className="text-muted-foreground ml-1.5">· {s.studentId}</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">Already enrolled</span>
              </div>
            ))}
          </div>
        )}

        {search.length >= 1 &&
          !searching &&
          results.length === 0 &&
          alreadyEnrolled.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2 px-1">
              No matches in school roster.
            </p>
          )}
      </div>

      {/* Create new student */}
      <div className="flex items-center gap-2">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground shrink-0">or create new student</span>
        <div className="flex-1 border-t border-border" />
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            value={createFirstName}
            onChange={(e) => setCreateFirstName(e.target.value)}
            placeholder="First name *"
            className="h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => e.key === "Enter" && createAndEnroll()}
          />
          <input
            value={createLastName}
            onChange={(e) => setCreateLastName(e.target.value)}
            placeholder="Last name *"
            className="h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => e.key === "Enter" && createAndEnroll()}
          />
        </div>
        <input
          value={createStudentId}
          onChange={(e) => setCreateStudentId(e.target.value)}
          placeholder="Student ID (optional)"
          className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={(e) => e.key === "Enter" && createAndEnroll()}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button size="sm" className="w-full" onClick={createAndEnroll} disabled={creating}>
          {creating ? "Creating…" : "Create & Enroll"}
        </Button>
      </div>
    </div>
  );
}

// ─── Class Order Drag & Drop ──────────────────────────

function ClassOrderList({
  classOrder,
  setClassOrder,
  studentsByClass,
  locked = false,
}: {
  classOrder: ClassGroup[];
  setClassOrder: (order: ClassGroup[]) => void;
  studentsByClass: Map<string, Student[]>;
  locked?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIndex = classOrder.findIndex(
        (c) => gradeKey(c.grade, c.teacher) === active.id
      );
      const newIndex = classOrder.findIndex(
        (c) => gradeKey(c.grade, c.teacher) === over.id
      );
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

  if (locked) {
    return (
      <div className="space-y-1">
        {classOrder.map((group, index) => {
          const key = gradeKey(group.grade, group.teacher);
          const count = studentsByClass.get(key)?.length || 0;
          return (
            <div
              key={key}
              className="flex items-center gap-3 rounded-md border bg-background px-3 py-2"
            >
              <span className="text-sm font-medium w-6 text-muted-foreground">{index + 1}.</span>
              <span className="text-sm font-medium">{gradeLabel(group.grade)}</span>
              <span className="text-sm text-muted-foreground">— {group.teacher}</span>
              <span className="ml-auto text-xs text-muted-foreground">{count} students</span>
            </div>
          );
        })}
      </div>
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
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-sm font-medium w-6 text-muted-foreground">{index + 1}.</span>
      <span className="text-sm font-medium">{gradeLabel(group.grade)}</span>
      <span className="text-sm text-muted-foreground">— {group.teacher}</span>
      <span className="ml-auto text-xs text-muted-foreground">{studentCount} students</span>
    </div>
  );
}
