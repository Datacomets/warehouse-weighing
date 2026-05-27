#!/usr/bin/env node
/**
 * One-shot migration from the old Supabase project to the new one.
 *
 * Required env vars:
 *   OLD_URL, OLD_KEY  — old project URL + service_role key
 *   NEW_URL, NEW_KEY  — new project URL + service_role key
 *   PASSWORDS_JSON    — JSON map of empCode → password for active users
 *                       (e.g. '{"10352":"xTCab67b5n","10162":"5TzZmfab5b"}')
 *                       Users not in the map get a throwaway password.
 *
 * Pre-flight (must already be done before running):
 *   1. NEW project has been bootstrapped via scripts/bootstrap-schema.sql
 *   2. Storage buckets gr-photos and sap-attachments exist on the NEW project
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const OLD_URL = process.env.OLD_URL;
const OLD_KEY = process.env.OLD_KEY;
const NEW_URL = process.env.NEW_URL;
const NEW_KEY = process.env.NEW_KEY;
const PASSWORDS = JSON.parse(process.env.PASSWORDS_JSON || "{}");

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error("Missing env vars: OLD_URL, OLD_KEY, NEW_URL, NEW_KEY");
  process.exit(1);
}

const EMP_EMAIL_DOMAIN = "comets.local";
function empCodeFromEmail(email) {
  const suffix = `@${EMP_EMAIL_DOMAIN}`;
  return email?.endsWith(suffix) ? email.slice(0, -suffix.length) : null;
}

function randomThrowaway(len = 16) {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

const old = createClient(OLD_URL, OLD_KEY, { auth: { persistSession: false } });
const neu = createClient(NEW_URL, NEW_KEY, { auth: { persistSession: false } });

async function fetchAll(client, table, { pageSize = 1000, select = "*" } = {}) {
  const all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error(`  ❌ fetch ${table} offset=${offset}:`, error.message);
      throw error;
    }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function insertBatched(client, table, rows, { batchSize = 500 } = {}) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await client.from(table).insert(batch);
    if (error) {
      console.error(
        `  ❌ insert ${table} batch ${i}-${i + batch.length}:`,
        error.message
      );
      throw error;
    }
    const done = Math.min(i + batchSize, rows.length);
    process.stdout.write(`\r    ${done} / ${rows.length}`);
  }
  process.stdout.write("\n");
}

async function listAllFiles(client, bucket, prefix = "") {
  const { data, error } = await client.storage
    .from(bucket)
    .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) {
    console.error(`  ❌ list ${bucket}/${prefix}:`, error.message);
    return [];
  }
  const files = [];
  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) {
      files.push(fullPath);
    } else {
      const sub = await listAllFiles(client, bucket, fullPath);
      files.push(...sub);
    }
  }
  return files;
}

async function migrateStorageBucket(bucket) {
  const files = await listAllFiles(old, bucket);
  console.log(`  ${bucket}: ${files.length} files`);
  let success = 0,
    fail = 0;
  for (const path of files) {
    const { data: blob, error: dlErr } = await old.storage
      .from(bucket)
      .download(path);
    if (dlErr) {
      console.error(`    ❌ download ${path}:`, dlErr.message);
      fail++;
      continue;
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    const { error: upErr } = await neu.storage
      .from(bucket)
      .upload(path, buf, { contentType: blob.type, upsert: true });
    if (upErr) {
      console.error(`    ❌ upload ${path}:`, upErr.message);
      fail++;
      continue;
    }
    success++;
    if (success % 10 === 0) {
      process.stdout.write(`\r    ${success} / ${files.length}`);
    }
  }
  process.stdout.write("\n");
  console.log(`  ✅ ${success} ok, ${fail} failed`);
}

async function updateStorageUrls() {
  const oldHost = OLD_URL.replace(/^https?:\/\//, "");
  const newHost = NEW_URL.replace(/^https?:\/\//, "");

  // weight_photos.url
  const { data: photos } = await neu.from("weight_photos").select("id,url");
  for (const p of photos || []) {
    if (p.url?.includes(oldHost)) {
      await neu
        .from("weight_photos")
        .update({ url: p.url.replace(oldHost, newHost) })
        .eq("id", p.id);
    }
  }
  console.log(`  ✅ weight_photos.url`);

  // gr_documents.sap_attachment_url
  const { data: docs } = await neu
    .from("gr_documents")
    .select("id,sap_attachment_url");
  for (const d of docs || []) {
    if (d.sap_attachment_url?.includes(oldHost)) {
      await neu
        .from("gr_documents")
        .update({
          sap_attachment_url: d.sap_attachment_url.replace(oldHost, newHost),
        })
        .eq("id", d.id);
    }
  }
  console.log(`  ✅ gr_documents.sap_attachment_url`);

  // issue_reports.photos (array)
  const { data: issues } = await neu.from("issue_reports").select("id,photos");
  for (const i of issues || []) {
    if (Array.isArray(i.photos) && i.photos.some((u) => u?.includes(oldHost))) {
      const newPhotos = i.photos.map((u) =>
        u?.replace(oldHost, newHost) ?? u
      );
      await neu.from("issue_reports").update({ photos: newPhotos }).eq("id", i.id);
    }
  }
  console.log(`  ✅ issue_reports.photos[]`);
}

async function run() {
  console.log("=== COMETS GR Data Migration ===");
  console.log("  OLD:", OLD_URL);
  console.log("  NEW:", NEW_URL);
  console.log("");

  // ─────────────────────────────────────────────────────
  console.log("[1/12] Fetching old auth users...");
  const {
    data: { users: oldAuthUsers },
    error: authErr,
  } = await old.auth.admin.listUsers({ perPage: 1000 });
  if (authErr) throw authErr;
  console.log(`  Found ${oldAuthUsers.length} auth users`);

  console.log("[2/12] Fetching old profiles...");
  const oldProfiles = await fetchAll(old, "profiles");
  const profileById = new Map(oldProfiles.map((p) => [p.id, p]));
  console.log(`  Found ${oldProfiles.length} profiles`);

  // ─────────────────────────────────────────────────────
  console.log("[3/12] Creating users on NEW project...");
  const userIdMap = new Map(); // old_id → new_id
  const passwordReport = []; // [{ emp, name, password, source }]
  for (const u of oldAuthUsers) {
    const emp = empCodeFromEmail(u.email);
    const oldProf = profileById.get(u.id);
    const knownPassword = emp ? PASSWORDS[emp] : null;
    const password = knownPassword ?? randomThrowaway();

    const { data: created, error } = await neu.auth.admin.createUser({
      email: u.email,
      password,
      email_confirm: true,
      user_metadata: {
        ...u.user_metadata,
        full_name: oldProf?.full_name ?? u.user_metadata?.full_name,
        role: oldProf?.role ?? u.user_metadata?.role,
      },
    });
    if (error) {
      console.error(`  ❌ ${u.email}:`, error.message);
      continue;
    }
    userIdMap.set(u.id, created.user.id);
    const source = knownPassword ? "original" : "throwaway";
    passwordReport.push({
      emp,
      name: oldProf?.full_name ?? "(no profile)",
      role: oldProf?.role ?? "(no role)",
      active: oldProf?.active ?? true,
      password,
      source,
    });
    console.log(`  ✅ ${emp} ${oldProf?.full_name ?? ""} (${source})`);
  }

  // ─────────────────────────────────────────────────────
  console.log("[4/12] Updating profiles (full_name, role, active)...");
  for (const p of oldProfiles) {
    const newId = userIdMap.get(p.id);
    if (!newId) {
      console.warn(`  ⚠ no auth user mapping for profile ${p.full_name}`);
      continue;
    }
    const { error } = await neu
      .from("profiles")
      .update({
        full_name: p.full_name,
        role: p.role,
        active: p.active,
      })
      .eq("id", newId);
    if (error) console.error(`  ❌ ${p.full_name}:`, error.message);
  }
  console.log(`  ✅ ${oldProfiles.length} profiles updated`);

  const remap = (uuid) => (uuid ? userIdMap.get(uuid) ?? null : null);

  // ─────────────────────────────────────────────────────
  console.log("[5/12] Migrating running_numbers...");
  const rn = await fetchAll(old, "running_numbers");
  if (rn.length) {
    const { error } = await neu.from("running_numbers").upsert(rn);
    if (error) throw error;
  }
  console.log(`  ✅ ${rn.length} rows`);

  // ─────────────────────────────────────────────────────
  console.log("[6/12] Migrating item_master (large)...");
  const items = await fetchAll(old, "item_master");
  console.log(`  Fetched ${items.length} items`);
  await insertBatched(neu, "item_master", items);

  // ─────────────────────────────────────────────────────
  console.log("[7/12] Migrating gr_documents...");
  const docs = await fetchAll(old, "gr_documents");
  const docsRemapped = docs.map((d) => ({
    ...d,
    created_by: remap(d.created_by),
    submitted_by: remap(d.submitted_by),
    closed_by: remap(d.closed_by),
  }));
  await insertBatched(neu, "gr_documents", docsRemapped);

  // ─────────────────────────────────────────────────────
  console.log("[8/12] Migrating weight_measurements...");
  const wm = await fetchAll(old, "weight_measurements");
  await insertBatched(neu, "weight_measurements", wm);

  // ─────────────────────────────────────────────────────
  console.log("[9/12] Migrating count_grid_entries...");
  const cg = await fetchAll(old, "count_grid_entries");
  await insertBatched(neu, "count_grid_entries", cg);

  // ─────────────────────────────────────────────────────
  console.log("[10/12] Migrating issue_reports (URLs not yet remapped)...");
  const ir = await fetchAll(old, "issue_reports");
  const irRemapped = ir.map((r) => ({ ...r, created_by: remap(r.created_by) }));
  await insertBatched(neu, "issue_reports", irRemapped);

  // ─────────────────────────────────────────────────────
  console.log("[11/12] Migrating weight_photos (URLs not yet remapped)...");
  const wp = await fetchAll(old, "weight_photos");
  await insertBatched(neu, "weight_photos", wp);

  console.log("[11b] Migrating audit_log...");
  const al = await fetchAll(old, "audit_log");
  const alRemapped = al.map((a) => ({ ...a, actor: remap(a.actor) }));
  await insertBatched(neu, "audit_log", alRemapped);

  // ─────────────────────────────────────────────────────
  console.log("[12/12] Migrating storage buckets...");
  console.log(" → gr-photos");
  await migrateStorageBucket("gr-photos");
  console.log(" → sap-attachments");
  await migrateStorageBucket("sap-attachments");

  console.log("[12b] Rewriting storage URLs in DB...");
  await updateStorageUrls();

  // ─────────────────────────────────────────────────────
  console.log("");
  console.log("=== ✅ MIGRATION COMPLETE ===");
  console.log("");
  console.log("Password report:");
  console.log("──────────────────────────────────────────────────────────");
  console.log("EMP    ROLE          NAME                          PASSWORD");
  console.log("──────────────────────────────────────────────────────────");
  for (const r of passwordReport) {
    if (!r.active) continue;
    const line =
      (r.emp ?? "(none)").padEnd(6) +
      (r.role ?? "").padEnd(13) +
      (r.name ?? "").padEnd(30) +
      r.password +
      (r.source === "original" ? "" : "  ← NEW");
    console.log(line);
  }
  console.log("──────────────────────────────────────────────────────────");
  console.log("");
  console.log("Inactive users (deactivated — throwaway passwords):");
  for (const r of passwordReport) {
    if (r.active) continue;
    console.log(`  ${r.emp ?? "(none)"} ${r.name ?? ""} (${r.role})`);
  }
}

run().catch((e) => {
  console.error("\n💥 Fatal:", e);
  process.exit(1);
});
