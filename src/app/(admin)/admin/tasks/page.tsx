import { Board } from "@/components/admin/kanban/Board";

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Internal task board for the team.
        </p>
      </div>
      <Board />
    </div>
  );
}
