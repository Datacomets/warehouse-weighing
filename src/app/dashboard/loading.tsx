import { TopAppBar } from "@/components/TopAppBar";
import { StatSkeleton, Skeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <>
      <TopAppBar title="Dashboard" subtitle="" />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-4">
        <section className="grid grid-cols-2 gap-3">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </section>
        <Skeleton className="h-48 w-full" />
      </main>
    </>
  );
}
