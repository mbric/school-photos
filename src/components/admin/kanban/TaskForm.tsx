"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Task, TaskFormData, TaskPriority, TaskStatus, TaskUser } from "./Board";

const selectClass =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const BOTH_VALUE = "__both__";

interface TaskFormProps {
  task?: Task;
  users: TaskUser[];
  onSubmit: (data: TaskFormData) => Promise<void>;
  onClose: () => void;
}

export function TaskForm({ task, users, onSubmit, onClose }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "TODO");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "P3");
  const [assigneeValue, setAssigneeValue] = useState(() => {
    if (task?.shared) return BOTH_VALUE;
    if (task) return task.assigneeId ?? users[0]?.id ?? "";
    return BOTH_VALUE;
  });
  const [submitting, setSubmitting] = useState(false);

  const mattUser = users.find((u) => u.name === "Matt") ?? users[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const isBoth = assigneeValue === BOTH_VALUE;
    setSubmitting(true);
    await onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      assigneeId: isBoth ? (mattUser?.id ?? assigneeValue) : assigneeValue,
      shared: isBoth,
    });
    setSubmitting(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg border shadow-lg w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {task ? "Edit Task" : "New Task"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details…"
              rows={3}
              className={`${selectClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="status">Column</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className={selectClass}
              >
                <option value="TODO">Do Now</option>
                <option value="IN_PROGRESS">Up Next</option>
                <option value="DONE">Later</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className={selectClass}
              >
                <option value="P1">P1 — Critical</option>
                <option value="P2">P2 — Normal</option>
                <option value="P3">P3 — Low</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="assignee">Assignee</Label>
              <select
                id="assignee"
                value={assigneeValue}
                onChange={(e) => setAssigneeValue(e.target.value)}
                className={selectClass}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
                <option value={BOTH_VALUE}>All</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? "Saving…" : task ? "Save changes" : "Create task"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
