import { TopAppBar } from "@/components/TopAppBar";
import { StepNavSkeleton, Skeleton } from "@/components/Skeleton";

export default function DocLoading() {
  return (
    <>
      <TopAppBar title="" subtitle="เอกสารตรวจรับสินค้า" showBack />
      <main className="mt-16 pb-32 px-4">
        <StepNavSkeleton />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </main>
    </>
  );
}
