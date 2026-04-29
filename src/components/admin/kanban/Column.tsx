"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { Card } from "./Card";
import type { Task, TaskStatus } from "./Board";

interface ColumnProps {
  id: TaskStatus;
  label: string;
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
}

export function Column({ id, label, tasks, onEdit, onDelete, onComplete }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const taskIds = tasks.map((t) => t.id);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-2 min-h-48 rounded-lg p-2 transition-colors",
          isOver ? "bg-primary/5 ring-1 ring-primary/20" : "bg-muted/40"
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <Card key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} onComplete={onComplete} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
