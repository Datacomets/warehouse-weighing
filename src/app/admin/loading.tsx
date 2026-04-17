import { TopAppBar } from "@/components/TopAppBar";
import { CardSkeleton, Skeleton } from "@/components/Skeleton";

export default function AdminLoading() {
  return (
    <>
      <TopAppBar title="Admin" subtitle="" />
      <main className="mt-16 pb-32 px-4 flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </main>
    </>
  );
}
