import { CardSkeleton, TableSkeleton } from "@/components/skeleton";

export default function OrdersLoading() {
  return (
    <div>
      <div className="h-9 w-32 bg-muted animate-pulse rounded-md mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <TableSkeleton rows={5} />
    </div>
  );
}
