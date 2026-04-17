import { TopAppBar } from "@/components/TopAppBar";
import { CardSkeleton, StatSkeleton } from "@/components/Skeleton";

export default function HomeLoading() {
  return (
    <>
      <TopAppBar title="COMETS GR" subtitle="" />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-4">
        {/* filter bar placeholder */}
        <div className="h-10" />

        <section className="grid grid-cols-2 gap-3">
          <StatSkeleton />
          <StatSkeleton />
        </section>

        <div className="flex flex-col gap-4 mt-2">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </main>
    </>
  );
}
