#!/usr/bin/env node
// Bulk-create staff accounts as Supabase auth users with pseudo-emails.
// Usage:  node scripts/seed-users.mjs
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
// Skips users whose emp_code already exists. Prints a table of generated
// passwords at the end — copy and distribute securely, they cannot be recovered.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");

function loadEnv(path) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawVal] = m;
    const val = rawVal.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv(envPath);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const EMP_EMAIL_DOMAIN = "comets.local";

const USERS = [
  { emp_code: "10352", full_name: "นางสาวอรกัญญา นุเวที",       role: "manager"   },
  { emp_code: "10162", full_name: "นางสาวโชติกา ชัยมัง",         role: "manager"   },
  { emp_code: "10169", full_name: "นายกิตติพงษ์ หาศรี",           role: "operator"  },
  { emp_code: "10533", full_name: "นายจาตุรงณ์ ดอนตะในย์",       role: "operator"  },
  { emp_code: "10898", full_name: "นายสมกิจ โส๊ะโหรน",           role: "operator"  },
  { emp_code: "10916", full_name: "นายมรุพงศ์ มุตุมาจันทร์",      role: "operator"  },
  { emp_code: "11211", full_name: "นายศุภณัฏฐ์ นิธิกุลภูวรัตน์",    role: "operator"  },
  { emp_code: "11228", full_name: "นายธนโชค ปาปะไน",             role: "admin_sap" },
];

function randomPassword(len = 10) {
  // No look-alike chars (0/O, 1/l/I)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];

for (const u of USERS) {
  const email = `${u.emp_code}@${EMP_EMAIL_DOMAIN}`;
  const password = randomPassword(10);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: u.full_name, role: u.role },
  });

  if (error) {
    results.push({ ...u, status: "SKIP / ERROR", password: "-", detail: error.message });
    continue;
  }

  const { error: profErr } = await admin
    .from("profiles")
    .update({ full_name: u.full_name, role: u.role })
    .eq("id", data.user.id);

  results.push({
    ...u,
    status: profErr ? "PROFILE ERROR" : "CREATED",
    password,
    detail: profErr?.message ?? "",
  });
}

console.log("");
console.log("=".repeat(100));
console.log("STAFF ACCOUNTS — store these passwords securely, they cannot be recovered");
console.log("=".repeat(100));
for (const r of results) {
  const line =
    `${r.emp_code.padEnd(7)}` +
    `${r.role.padEnd(11)}` +
    `${(r.full_name + "").padEnd(40)}` +
    `${r.status.padEnd(15)}` +
    `${r.password}`;
  console.log(line);
  if (r.detail) console.log(`        ↳ ${r.detail}`);
}
console.log("=".repeat(100));

const failed = results.filter((r) => r.status !== "CREATED").length;
process.exit(failed > 0 ? 1 : 0);
