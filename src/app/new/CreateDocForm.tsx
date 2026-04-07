"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MOCK_ERP_ITEMS, type ErpItem } from "@/lib/mock-erp";
import { Field, SectionHeader } from "@/components/Field";
import { Icon } from "@/components/Icon";

export function CreateDocForm({ whNumber, userId }: { whNumber: string; userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [erpKey, setErpKey] = useState<string>("");
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

  function applyErp(item: ErpItem) {
    setForm((f) => ({
      ...f,
      lot: item.lot,
      po_number: item.po_number,
      item_code: item.item_code,
      description: item.description,
      supplier: item.supplier,
      delivery_date: item.delivery_date,
    }));
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

      <SectionHeader icon="cloud_download" title="ดึงข้อมูลจาก ERP (Mock)" accent />
      <Field label="เลือกรายการจาก Packing List">
        <select
          value={erpKey}
          onChange={(e) => {
            setErpKey(e.target.value);
            const it = MOCK_ERP_ITEMS.find((x) => x.po_number === e.target.value);
            if (it) applyErp(it);
          }}
          className="input-base"
        >
          <option value="">-- เลือกหรือกรอกเอง --</option>
          {MOCK_ERP_ITEMS.map((it) => (
            <option key={it.po_number} value={it.po_number}>
              {it.po_number} · {it.item_code} · {it.description}
            </option>
          ))}
        </select>
      </Field>

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
            onChange={(e) => setForm({ ...form, item_code: e.target.value })}
            className="input-base"
          />
        </Field>
        <Field label="Description" required className="col-span-2">
          <input
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-base"
          />
        </Field>
        <Field label="Supplier" className="col-span-2">
          <input
            value={form.supplier}
            onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            className="input-base"
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
