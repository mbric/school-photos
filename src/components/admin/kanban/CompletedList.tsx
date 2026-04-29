"use client";

import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import type { Task } from "./Board";

const COLUMN_LABEL: Record<string, string> = {
  TODO: "Do Now",
  IN_PROGRESS: "Up Next",
  DONE: "Later",
};

const NAME_STYLE: Record<string, string> = {
  Matt: "bg-blue-100 text-blue-700",
  Megan: "bg-purple-100 text-purple-700",
};

interface CompletedListProps {
  tasks: Task[];
  loading: boolean;
  onRestore: (id: string) => void;
}

export function CompletedList({ tasks, loading, onRestore }: CompletedListProps) {
  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading…</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="text-muted-foreground text-sm py-8 text-center">
        No completed tasks yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const assigneeLabel = task.shared
          ? "All"
          : (task.assignee?.name ?? "—");
        const assigneeClass = task.shared
          ? "bg-teal-100 text-teal-700"
          : (NAME_STYLE[task.assignee?.name ?? ""] ?? "bg-muted text-muted-foreground");

        const completedDate = task.completedAt
          ? new Date(task.completedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : null;

        return (
          <div
            key={task.id}
            className="flex items-center gap-3 rounded-md border bg-background px-3 py-2.5 text-sm shadow-sm group"
          >
            <p className={cn("flex-1 line-through text-muted-foreground")}>
              {task.title}
            </p>
            <span className="text-xs text-muted-foreground hidden sm:block">
              {COLUMN_LABEL[task.status] ?? task.status}
            </span>
            {!task.shared && (
              <span
                className={cn(
                  "text-xs font-medium rounded-full px-2 py-0.5 shrink-0",
                  assigneeClass
                )}
              >
                {assigneeLabel}
              </span>
            )}
            {completedDate && (
              <span className="text-xs text-muted-foreground shrink-0 hidden md:block">
                {completedDate}
              </span>
            )}
            <button
              onClick={() => onRestore(task.id)}
              title="Restore task"
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground transition-opacity shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
