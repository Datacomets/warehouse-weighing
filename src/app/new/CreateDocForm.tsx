"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field, SectionHeader } from "@/components/Field";
import { Icon } from "@/components/Icon";

export function CreateDocForm({ whNumber, userId }: { whNumber: string; userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    lot: "",
    po_number: "",
    item_code: "",
    description: "",
    supplier: "",
    delivery_date: "",
    sap_inbound_id: "",
    sap_notification_id: "",
  });

  async function lookupItemCode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) {
      setLookupMsg(null);
      return;
    }
    const { data, error } = await supabase
      .from("item_master")
      .select("description, product_category, obsolete")
      .eq("item_code", trimmed)
      .maybeSingle();
    if (error) {
      setLookupMsg("ค้นหา Item Code ไม่สำเร็จ");
      return;
    }
    if (data?.description) {
      setForm((f) => ({ ...f, description: data.description }));
      const cat = data.product_category ? ` · ${data.product_category}` : "";
      if (data.obsolete) {
        setLookupMsg(`⚠ Item นี้ถูกยกเลิก (Obsolete)${cat}`);
      } else {
        setLookupMsg(`พบใน Item Master — กรอก Description ให้แล้ว${cat}`);
      }
    } else {
      setLookupMsg("ไม่พบ Item Code นี้ใน Master — กรุณากรอก Description เอง");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    const { data, error } = await supabase
      .from("gr_documents")
      .insert({
        wh_number: whNumber,
        status: "in_progress",
        ...form,
        delivery_date: form.delivery_date || null,
        sap_inbound_id: form.sap_inbound_id || null,
        sap_notification_id: form.sap_notification_id || null,
        created_by: userId,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      setErr(error?.message || "บันทึกไม่สำเร็จ");
      return;
    }
    await supabase.from("audit_log").insert({
      document_id: data.id,
      actor: userId,
      action: "create_doc",
      detail: { wh_number: whNumber },
    });
    router.push(`/doc/${data.id}/header`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="card border-l-4 border-primary-container">
        <span className="section-title">เลขเอกสาร (Auto-Generated)</span>
        <div className="flex items-center justify-between mt-1">
          <h2 className="text-2xl font-headline font-extrabold text-primary">{whNumber}</h2>
          <span className="bg-tertiary-container text-on-tertiary-container px-3 py-1 rounded-full text-[10px] font-bold uppercase">
            ใหม่
          </span>
        </div>
        <p className="text-[11px] text-outline mt-1">
          เลขนี้ถูกล็อกโดยระบบและไม่สามารถแก้ไขได้
        </p>
      </div>

      <SectionHeader icon="description" title="ข้อมูลพื้นฐาน" accent />
      <div className="grid grid-cols-2 gap-3">
        <Field label="LOT" required>
          <input
            required
            value={form.lot}
            onChange={(e) => setForm({ ...form, lot: e.target.value })}
            className="input-base"
          />
        </Field>
        <Field label="PO Number" required>
          <input
            required
            value={form.po_number}
            onChange={(e) => setForm({ ...form, po_number: e.target.value })}
            className="input-base"
          />
        </Field>
        <Field label="Item Code (SAP)" required className="col-span-2">
          <input
            required
            value={form.item_code}
            onChange={(e) => {
              setForm({ ...form, item_code: e.target.value });
              setLookupMsg(null);
            }}
            onBlur={(e) => lookupItemCode(e.target.value)}
            className="input-base"
            placeholder="กรอกแล้ว tab ออก เพื่อดึง Description"
          />
          {lookupMsg ? (
            <p className="text-[11px] text-outline mt-1">{lookupMsg}</p>
          ) : (
            <p className="text-[11px] text-outline mt-1">กรอก Item Code แล้วแตะที่อื่น เพื่อดึง Description จาก Item Master</p>
          )}
        </Field>
        <Field label="Description" required className="col-span-2">
          <input
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-base"
          />
        </Field>
        <Field label="ชื่อสินค้าฝั่ง Supplier" hint="ชื่อที่ Supplier ใช้เรียกสินค้านี้" className="col-span-2">
          <input
            value={form.supplier}
            onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            className="input-base"
            placeholder="เช่น LOVE POTION GLX LIP GLOSS"
          />
        </Field>
        <Field label="Delivery Date" className="col-span-2">
          <input
            type="date"
            value={form.delivery_date}
            onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
            className="input-base"
          />
        </Field>
      </div>

      <SectionHeader icon="link" title="ข้อมูล SAP (Optional)" accent />
      <Field label="Inbound Delivery ID (CFSD)" hint="กรอกภายหลังก็ได้">
        <input
          value={form.sap_inbound_id}
          onChange={(e) => setForm({ ...form, sap_inbound_id: e.target.value })}
          className="input-base"
          placeholder="เช่น CFSD-8634"
        />
      </Field>
      <Field label="Delivery Notification ID">
        <input
          value={form.sap_notification_id}
          onChange={(e) => setForm({ ...form, sap_notification_id: e.target.value })}
          className="input-base"
          placeholder="เช่น INV26-CWZ014#7"
        />
      </Field>

      {err && (
        <div className="bg-error-container text-on-error-container text-xs px-3 py-2 rounded-lg">
          {err}
        </div>
      )}

      <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-background via-background to-transparent px-4 py-4 z-30">
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? "กำลังสร้างเอกสาร..." : "เริ่มบันทึก"}
          <Icon name="arrow_forward" />
        </button>
      </div>
    </form>
  );
}
