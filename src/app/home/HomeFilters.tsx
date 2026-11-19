"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "clsx";
import { thumbUrl } from "@/lib/reportPhotos";

type Suggest = {
  item_code: string;
  description: string | null;
  product_category: string | null;
  obsolete: boolean;
  doc_count: number;
  cover_url: string | null;
  total: number;
};

/** Bold the part of `text` that matches `q` (case-insensitive). */
function Hi({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (!q || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-[#ffe7b8] text-inherit rounded-sm">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function HomeFilters({
  defaultQ,
  defaultTab,
}: {
  defaultQ: string;
  defaultTab: "in_progress" | "completed";
}) {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [text, setText] = useState(defaultQ);
  const [list, setList] = useState<Suggest[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLFormElement>(null);
  const seq = useRef(0);

  useEffect(() => setText(defaultQ), [defaultQ]);

  // suggestions while typing (3+ characters), debounced
  useEffect(() => {
    const q = text.trim();
    if (q.length < 3 || q === defaultQ) {
      setList([]);
      setOpen(false);
      return;
    }
    const my = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("search_items", { q });
      if (my !== seq.current) return;
      setList((data as Suggest[]) || []);
      setActive(-1);
      setOpen(true);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // close on outside tap
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function setTab(tab: "in_progress" | "completed") {
    const sp = new URLSearchParams(params);
    sp.set("tab", tab);
    router.push(`/home?${sp.toString()}`);
  }
  function goSearch(q: string) {
    setOpen(false);
    const sp = new URLSearchParams(params);
    if (q) sp.set("q", q);
    else sp.delete("q");
    router.push(`/home?${sp.toString()}`);
  }
  function goItem(code: string) {
    setOpen(false);
    router.push(`/item/${encodeURIComponent(code)}`);
  }
  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (open && active >= 0 && list[active]) return goItem(list[active].item_code);
    goSearch(text.trim());
  }
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setText(e.target.value);
    // emptying the box (typing it away or the native ✕) goes straight back to the normal list
    if (e.target.value.trim() === "" && params.get("q")) goSearch("");
  }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !list.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Escape") setOpen(false);
  }

  const q = text.trim();

  return (
    <>
      <form ref={boxRef} onSubmit={onSearch} className="relative z-[45]">
        <button
          type="submit"
          aria-label="ค้นหา"
          title="ค้นหา"
          className="absolute left-2 top-7 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center text-primary-container hover:bg-primary-fixed active:scale-95 transition"
        >
          <Icon name="search" />
        </button>
        <button
          type="submit"
          className="absolute right-2 top-7 -translate-y-1/2 z-10 h-10 px-4 sm:px-5 rounded-xl bg-primary-container text-white text-sm font-headline font-bold inline-flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition"
        >
          ค้นหา
        </button>
        <input
          name="q"
          type="search"
          value={text}
          onChange={onChange}
          onKeyDown={onKey}
          onFocus={() => list.length && setOpen(true)}
          autoComplete="off"
          className="input-base h-14 pl-12 pr-24 sm:pr-28 bg-white border-2 border-primary-container shadow-[0_6px_18px_rgba(0,0,128,0.12)] text-[15px] placeholder:text-outline focus:ring-4 focus:ring-primary-fixed focus:border-primary-container"
          placeholder="ค้นหา WH-, LOT, PO, Item Code, Description..."
          role="combobox"
          aria-expanded={open}
          aria-controls="item-suggest"
        />
        {open && (
          <div id="item-suggest" role="listbox" className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-[0_12px_32px_rgba(0,0,60,0.18)] border border-outline-variant/30 overflow-hidden">
            <div className="text-[11px] text-outline font-bold px-4 py-2 bg-surface-container-low">
              {list.length === 0
                ? loading
                  ? "กำลังค้นหา..."
                  : `ไม่พบสินค้าที่ตรงกับ "${q}"`
                : `สินค้าที่ตรงกับ "${q}" · ${list.length} จาก ${list[0].total.toLocaleString()} รายการ`}
            </div>
            {list.map((s, i) => (
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                key={s.item_code}
                onMouseEnter={() => setActive(i)}
                onClick={() => goItem(s.item_code)}
                className={clsx("w-full flex items-center gap-3 px-4 py-2.5 text-left border-t border-outline-variant/20", i === active && "bg-[#eef0ff]")}
              >
                {s.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbUrl(s.cover_url, 96)} alt="" className="w-11 h-11 rounded-lg object-cover flex-none bg-surface-container-low" />
                ) : (
                  <span className="w-11 h-11 rounded-lg border-2 border-dashed border-outline-variant flex items-center justify-center flex-none">
                    <Icon name="image" className="text-outline text-base" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-sm">
                    <Hi text={s.item_code} q={q} />
                    {s.obsolete && <span className="ml-2 text-[10px] text-error font-bold">Obsolete</span>}
                  </span>
                  <span className="block text-[11px] text-outline truncate">
                    <Hi text={s.description || "—"} q={q} />
                  </span>
                </span>
                <span className="text-[10px] text-outline bg-surface-container-low rounded-full px-2 py-0.5 whitespace-nowrap">
                  {s.doc_count > 0 ? `${s.doc_count} ใบ` : "ยังไม่มีใบงาน"}
                </span>
              </button>
            ))}
            {list.length > 0 && (
              <button type="button" onClick={() => goSearch(q)} className="w-full text-left px-4 py-2.5 text-xs font-bold text-primary border-t border-outline-variant/20 hover:bg-surface-container-low">
                🔍 ค้นหาใบงานทั้งหมดที่มี &ldquo;{q}&rdquo;
              </button>
            )}
          </div>
        )}
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
