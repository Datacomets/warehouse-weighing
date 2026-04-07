"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/types";
import { Field } from "@/components/Field";
import { Icon } from "@/components/Icon";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "operator", label: "พนักงาน" },
  { value: "qc", label: "QC / หัวหน้างาน" },
  { value: "admin_sap", label: "Admin SAP" },
  { value: "manager", label: "ผู้จัดการ" },
  { value: "admin", label: "Admin (System)" },
];

export function UsersAdmin({ users }: { users: Profile[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [list, setList] = useState(users);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "operator" as UserRole,
  });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function createUser() {
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setErr(json.error || "Failed");
      return;
    }
    setOpen(false);
    setDraft({ email: "", password: "", full_name: "", role: "operator" });
    router.refresh();
  }

  async function updateRole(id: string, role: UserRole) {
    await supabase.from("profiles").update({ role }).eq("id", id);
    setList(list.map((u) => (u.id === id ? { ...u, role } : u)));
  }

  async function toggleActive(u: Profile) {
    await supabase.from("profiles").update({ active: !u.active }).eq("id", u.id);
    setList(list.map((x) => (x.id === u.id ? { ...x, active: !u.active } : x)));
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => setOpen(!open)} className="btn-primary self-start">
        <Icon name="person_add" /> เพิ่มผู้ใช้
      </button>

      {open && (
        <div className="card flex flex-col gap-3 border-l-4 border-primary-container">
          <Field label="อีเมล" required>
            <input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              className="input-base"
            />
          </Field>
          <Field label="รหัสผ่าน" required>
            <input
              type="password"
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              className="input-base"
            />
          </Field>
          <Field label="ชื่อ-นามสกุล" required>
            <input
              value={draft.full_name}
              onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
              className="input-base"
            />
          </Field>
          <Field label="Role">
            <select
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRole })}
              className="input-base"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          {err && <p className="text-xs text-error">{err}</p>}
          <button onClick={createUser} disabled={saving} className="btn-primary">
            {saving ? "กำลังสร้าง..." : "สร้าง"}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {list.map((u) => (
          <div key={u.id} className="card flex items-center justify-between">
            <div>
              <div className="font-headline font-bold text-primary">{u.full_name}</div>
              <div className="text-xs text-outline">{u.id.slice(0, 8)}...</div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={u.role}
                onChange={(e) => updateRole(u.id, e.target.value as UserRole)}
                className="input-base h-9 text-xs px-2 w-36"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => toggleActive(u)}
                className={
                  u.active
                    ? "btn-secondary h-9 text-xs px-3"
                    : "btn-primary h-9 text-xs px-3 bg-error"
                }
              >
                {u.active ? "เปิดใช้" : "ปิดใช้"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
