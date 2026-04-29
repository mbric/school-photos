"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Column } from "./Column";
import { Card } from "./Card";
import { TaskForm } from "./TaskForm";
import { CompletedList } from "./CompletedList";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "P1" | "P2" | "P3";

export interface TaskUser {
  id: string;
  name: string;
  email: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  shared: boolean;
  sortOrder: number;
  completedAt: string | null;
  assigneeId: string | null;
  assignee: TaskUser | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskFormData = {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  shared: boolean;
};

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "TODO", label: "Do Now" },
  { id: "IN_PROGRESS", label: "Up Next" },
  { id: "DONE", label: "Later" },
];

const COLUMN_IDS = new Set<string>(["TODO", "IN_PROGRESS", "DONE"]);

export function Board() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<TaskUser[]>([]);
  const [filter, setFilter] = useState("All");
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [taskSnapshot, setTaskSnapshot] = useState<Task[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedLoading, setCompletedLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetch("/api/admin/tasks?completed=false")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => {
        setTasks(data.tasks ?? []);
        setUsers(data.users ?? []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load tasks:", err);
        setLoading(false);
      });
  }, []);

  function handleTabChange(next: "active" | "completed") {
    setTab(next);
    if (next === "completed" && completedTasks.length === 0 && !completedLoading) {
      setCompletedLoading(true);
      fetch("/api/admin/tasks?completed=true")
        .then((r) => r.json())
        .then((data) => {
          setCompletedTasks(data.tasks ?? []);
          setCompletedLoading(false);
        })
        .catch(() => setCompletedLoading(false));
    }
  }

  function handleDragStart({ active }: DragStartEvent) {
    const task = tasks.find((t) => t.id === active.id) ?? null;
    setActiveTask(task);
    setTaskSnapshot([...tasks]);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    setTasks((prev) => {
      const activeIdx = prev.findIndex((t) => t.id === activeId);
      if (activeIdx === -1) return prev;

      const overTask = prev.find((t) => t.id === overId);

      if (overTask) {
        const withStatus = prev.map((t) =>
          t.id === activeId ? { ...t, status: overTask.status } : t
        );
        const newActiveIdx = withStatus.findIndex((t) => t.id === activeId);
        const newOverIdx = withStatus.findIndex((t) => t.id === overId);
        return arrayMove(withStatus, newActiveIdx, newOverIdx);
      }

      if (COLUMN_IDS.has(overId)) {
        const targetColumn = overId as TaskStatus;
        const withStatus = prev.map((t) =>
          t.id === activeId ? { ...t, status: targetColumn } : t
        );
        const colTasks = withStatus.filter(
          (t) => t.status === targetColumn && t.id !== activeId
        );
        if (colTasks.length === 0) return withStatus;
        const lastIdx = withStatus.findIndex(
          (t) => t.id === colTasks[colTasks.length - 1].id
        );
        const newActiveIdx = withStatus.findIndex((t) => t.id === activeId);
        return arrayMove(withStatus, newActiveIdx, lastIdx);
      }

      return prev;
    });
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);

    if (!over) {
      setTasks(taskSnapshot);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    let finalTasks = tasks;
    if (activeId !== overId && !COLUMN_IDS.has(overId)) {
      const overTask = tasks.find((t) => t.id === overId);
      const activeTask = tasks.find((t) => t.id === activeId);
      if (overTask && activeTask && activeTask.status === overTask.status) {
        const aIdx = tasks.findIndex((t) => t.id === activeId);
        const oIdx = tasks.findIndex((t) => t.id === overId);
        finalTasks = arrayMove(tasks, aIdx, oIdx);
      }
    }

    const withOrders = finalTasks.map((task) => ({
      ...task,
      sortOrder: finalTasks
        .filter((t) => t.status === task.status)
        .findIndex((t) => t.id === task.id),
    }));
    setTasks(withOrders);

    const changed = withOrders.filter((t) => {
      const orig = taskSnapshot.find((o) => o.id === t.id);
      return !orig || orig.status !== t.status || orig.sortOrder !== t.sortOrder;
    });

    await Promise.all(
      changed.map((t) =>
        fetch(`/api/admin/tasks/${t.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: t.status, sortOrder: t.sortOrder }),
        })
      )
    );
  }

  function handleDragCancel() {
    setActiveTask(null);
    setTasks(taskSnapshot);
  }

  async function createTask(data: TaskFormData) {
    const sortOrder = tasks.filter((t) => t.status === data.status).length;
    const res = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, sortOrder }),
    });
    const { task } = await res.json();
    setTasks((prev) => [...prev, { ...task, sortOrder }]);
    setShowCreate(false);
  }

  async function updateTask(id: string, data: TaskFormData) {
    const res = await fetch(`/api/admin/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const { task } = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
    setEditingTask(null);
  }

  async function deleteTask(id: string) {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/admin/tasks/${id}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function completeTask(id: string) {
    const res = await fetch(`/api/admin/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true }),
    });
    const { task } = await res.json();
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setCompletedTasks((prev) => [task, ...prev]);
  }

  async function restoreTask(id: string) {
    const res = await fetch(`/api/admin/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: false }),
    });
    const { task } = await res.json();
    setCompletedTasks((prev) => prev.filter((t) => t.id !== id));
    setTasks((prev) => [...prev, task]);
  }

  const filterOptions = ["All", ...users.map((u) => u.name), "Unassigned"];
  const filtered =
    filter === "All"
      ? tasks
      : filter === "Unassigned"
      ? tasks.filter((t) => t.shared)
      : tasks.filter((t) => !t.shared && t.assignee?.name === filter);

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading tasks…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 border-b">
        <button
          onClick={() => handleTabChange("active")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "active"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Active
          <span className="ml-1.5 text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
            {tasks.length}
          </span>
        </button>
        <button
          onClick={() => handleTabChange("completed")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "completed"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Completed
          {completedTasks.length > 0 && (
            <span className="ml-1.5 text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
              {completedTasks.length}
            </span>
          )}
        </button>
      </div>

      {tab === "completed" ? (
        <CompletedList
          tasks={completedTasks}
          loading={completedLoading}
          onRestore={restoreTask}
        />
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2">
              {filterOptions.map((a) => (
                <button
                  key={a}
                  onClick={() => setFilter(a)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    filter === a
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Task
            </Button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              {COLUMNS.map((col) => (
                <Column
                  key={col.id}
                  id={col.id}
                  label={col.label}
                  tasks={filtered.filter((t) => t.status === col.id)}
                  onEdit={setEditingTask}
                  onDelete={deleteTask}
                  onComplete={completeTask}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask && (
                <Card
                  task={activeTask}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onComplete={() => {}}
                  isOverlay
                />
              )}
            </DragOverlay>
          </DndContext>

          {showCreate && (
            <TaskForm
              users={users}
              onSubmit={createTask}
              onClose={() => setShowCreate(false)}
            />
          )}
          {editingTask && (
            <TaskForm
              task={editingTask}
              users={users}
              onSubmit={(data) => updateTask(editingTask.id, data)}
              onClose={() => setEditingTask(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
