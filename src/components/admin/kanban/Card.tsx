"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Check, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Task } from "./Board";

const PRIORITY_BORDER: Record<string, string> = {
  P1: "border-l-red-500",
  P2: "border-l-orange-500",
  P3: "border-l-green-500",
};

const NAME_STYLE: Record<string, string> = {
  Matt: "bg-blue-100 text-blue-700",
  Megan: "bg-purple-100 text-purple-700",
};

function getAssigneeDisplay(task: Task): { label: string; className: string } {
  if (task.shared) {
    return { label: "All", className: "bg-teal-100 text-teal-700" };
  }
  const name = task.assignee?.name ?? "—";
  return {
    label: name,
    className: NAME_STYLE[name] ?? "bg-muted text-muted-foreground",
  };
}

interface CardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  isOverlay?: boolean;
}

export function Card({ task, onEdit, onDelete, onComplete, isOverlay }: CardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const assignee = getAssigneeDisplay(task);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-background rounded-md border border-l-4 px-3 py-2.5 text-sm shadow-sm select-none relative group",
        PRIORITY_BORDER[task.priority] ?? "border-l-muted",
        isDragging && !isOverlay && "opacity-40",
        isOverlay ? "shadow-lg rotate-1 cursor-grabbing" : "cursor-grab"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-snug flex-1">{task.title}</p>
        {!isOverlay && (
          <div className="relative shrink-0 flex items-center gap-0.5">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}
              title="Mark complete"
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-green-100 hover:text-green-700 text-muted-foreground transition-opacity"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((o) => !o);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-6 z-10 bg-background border rounded-md shadow-md py-1 min-w-[120px]"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => { setMenuOpen(false); onEdit(task); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(task.id); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-muted"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {task.description}
        </p>
      )}

      {!task.shared && (
        <div className="mt-2">
          <span
            className={cn(
              "text-xs font-medium rounded-full px-2 py-0.5",
              assignee.className
            )}
          >
            {assignee.label}
          </span>
        </div>
      )}
    </div>
  );
}
