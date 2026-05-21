"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { clsx } from "clsx";

export function HomeFilters({
  defaultQ,
  defaultTab,
}: {
  defaultQ: string;
  defaultTab: "in_progress" | "completed";
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setTab(tab: "in_progress" | "completed") {
    const sp = new URLSearchParams(params);
    sp.set("tab", tab);
    router.push(`/home?${sp.toString()}`);
  }
  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = (new FormData(e.currentTarget).get("q") as string) || "";
    const sp = new URLSearchParams(params);
    if (q) sp.set("q", q);
    else sp.delete("q");
    router.push(`/home?${sp.toString()}`);
  }

  return (
    <>
      <form onSubmit={onSearch} className="relative">
        <Icon
          name="search"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-outline"
        />
        <input
          name="q"
          defaultValue={defaultQ}
          className="input-base h-14 pl-12"
          placeholder="ค้นหา WH-, LOT, PO, Item Code, Description..."
        />
      </form>

      <div className="flex border-b border-outline-variant/20">
        <button
          onClick={() => setTab("in_progress")}
          className={clsx(
            "flex-1 py-3 text-sm font-semibold border-b-2 transition-all",
            defaultTab === "in_progress"
              ? "border-tertiary-fixed-dim text-primary"
              : "border-transparent text-outline hover:text-primary"
          )}
        >
          กำลังดำเนินการ
        </button>
        <button
          onClick={() => setTab("completed")}
          className={clsx(
            "flex-1 py-3 text-sm font-semibold border-b-2 transition-all",
            defaultTab === "completed"
              ? "border-tertiary-fixed-dim text-primary"
              : "border-transparent text-outline hover:text-primary"
          )}
        >
          เสร็จสิ้น
        </button>
      </div>
    </>
  );
}
