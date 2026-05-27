#!/usr/bin/env node
/**
 * Catch-up migration — pulls anything created/edited on the OLD project
 * after the initial migration cutoff and re-applies it to the NEW project.
 *
 * Env vars required (same as migrate-data.mjs):
 *   OLD_URL, OLD_KEY, NEW_URL, NEW_KEY
 *   CUTOFF — ISO timestamp (rows with created_at/updated_at >= CUTOFF
 *            on OLD are considered candidates for catch-up)
 */

import { createClient } from "@supabase/supabase-js";

const OLD_URL = process.env.OLD_URL;
const OLD_KEY = process.env.OLD_KEY;
const NEW_URL = process.env.NEW_URL;
const NEW_KEY = process.env.NEW_KEY;
const CUTOFF = process.env.CUTOFF;

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY || !CUTOFF) {
  console.error("Missing env vars");
  process.exit(1);
}

const old = createClient(OLD_URL, OLD_KEY, { auth: { persistSession: false } });
const neu = createClient(NEW_URL, NEW_KEY, { auth: { persistSession: false } });

async function main() {
  console.log("=== Catch-up migration ===");
  console.log("  OLD:", OLD_URL);
  console.log("  NEW:", NEW_URL);
  console.log("  CUTOFF:", CUTOFF);
  console.log("");

  // 1. Build user id map (OLD → NEW) by email
  console.log("[1] Building user ID map (by email)…");
  const { data: { users: oldUsers } } = await old.auth.admin.listUsers({ perPage: 1000 });
  const { data: { users: newUsers } } = await neu.auth.admin.listUsers({ perPage: 1000 });
  const newByEmail = new Map(newUsers.map(u => [u.email, u.id]));
  const userIdMap = new Map();
  for (const u of oldUsers) {
    const newId = newByEmail.get(u.email);
    if (newId) userIdMap.set(u.id, newId);
  }
  console.log(`  Mapped ${userIdMap.size} / ${oldUsers.length} users`);
  const remap = (uuid) => (uuid ? userIdMap.get(uuid) ?? null : null);

  // 2. Find candidates on OLD: docs with created_at or updated_at >= CUTOFF
  console.log("[2] Finding candidate docs on OLD…");
  const { data: changedDocs } = await old
    .from("gr_documents")
    .select("*")
    .or(`created_at.gte.${CUTOFF},updated_at.gte.${CUTOFF}`)
    .order("created_at", { ascending: true });
  console.log(`  ${changedDocs.length} candidate doc(s)`);

  // 3. For each, classify: new (insert) vs edited (update)
  console.log("[3] Reconciling against NEW…");
  const inserts = [];
  const updates = [];
  for (const d of changedDocs) {
    const { data: existing } = await neu
      .from("gr_documents")
      .select("id,updated_at")
      .eq("id", d.id)
      .maybeSingle();
    if (!existing) {
      inserts.push(d);
    } else if (new Date(d.updated_at) > new Date(existing.updated_at)) {
      updates.push(d);
    }
  }
  console.log(`  → ${inserts.length} new doc(s), ${updates.length} edited doc(s)`);

  // 4. INSERT new docs (with remapped user UUIDs)
  for (const d of inserts) {
    const payload = {
      ...d,
      created_by: remap(d.created_by),
      submitted_by: remap(d.submitted_by),
      closed_by: remap(d.closed_by),
    };
    const { error } = await neu.from("gr_documents").insert(payload);
    if (error) console.error(`  ❌ insert ${d.wh_number}:`, error.message);
    else console.log(`  ✅ insert ${d.wh_number}`);
  }

  // 5. UPDATE edited docs
  for (const d of updates) {
    const { id, created_at, ...rest } = d;
    const payload = {
      ...rest,
      created_by: remap(d.created_by),
      submitted_by: remap(d.submitted_by),
      closed_by: remap(d.closed_by),
    };
    const { error } = await neu.from("gr_documents").update(payload).eq("id", d.id);
    if (error) console.error(`  ❌ update ${d.wh_number}:`, error.message);
    else console.log(`  ✅ update ${d.wh_number}`);
  }

  // 6. Migrate child rows for all candidate docs
  const docIds = changedDocs.map(d => d.id);
  if (docIds.length === 0) {
    console.log("\nNothing to migrate.");
    return;
  }

  const idList = docIds.map(id => `"${id}"`).join(",");

  // weight_measurements
  console.log("[4] Migrating weight_measurements…");
  const { data: wm } = await old
    .from("weight_measurements").select("*").in("document_id", docIds);
  await neu.from("weight_measurements").delete().in("document_id", docIds);
  if (wm?.length) {
    const { error } = await neu.from("weight_measurements").insert(wm);
    if (error) console.error("  ❌", error.message); else console.log(`  ✅ ${wm.length}`);
  } else console.log("  (none)");

  // count_grid_entries
  console.log("[5] Migrating count_grid_entries…");
  const { data: cg } = await old
    .from("count_grid_entries").select("*").in("document_id", docIds);
  await neu.from("count_grid_entries").delete().in("document_id", docIds);
  if (cg?.length) {
    const { error } = await neu.from("count_grid_entries").insert(cg);
    if (error) console.error("  ❌", error.message); else console.log(`  ✅ ${cg.length}`);
  } else console.log("  (none)");

  // issue_reports
  console.log("[6] Migrating issue_reports…");
  const { data: ir } = await old
    .from("issue_reports").select("*").in("document_id", docIds);
  await neu.from("issue_reports").delete().in("document_id", docIds);
  if (ir?.length) {
    const mapped = ir.map(r => ({ ...r, created_by: remap(r.created_by) }));
    const { error } = await neu.from("issue_reports").insert(mapped);
    if (error) console.error("  ❌", error.message); else console.log(`  ✅ ${ir.length}`);
  } else console.log("  (none)");

  // weight_photos
  console.log("[7] Migrating weight_photos…");
  const { data: wp } = await old
    .from("weight_photos").select("*").in("document_id", docIds);
  await neu.from("weight_photos").delete().in("document_id", docIds);
  if (wp?.length) {
    // rewrite URLs from old host to new host before insert
    const oldHost = OLD_URL.replace(/^https?:\/\//, "");
    const newHost = NEW_URL.replace(/^https?:\/\//, "");
    const mapped = wp.map(p => ({
      ...p,
      url: p.url ? p.url.replace(oldHost, newHost) : p.url,
    }));
    const { error } = await neu.from("weight_photos").insert(mapped);
    if (error) console.error("  ❌", error.message); else console.log(`  ✅ ${wp.length}`);
  } else console.log("  (none)");

  // audit_log
  console.log("[8] Migrating audit_log…");
  const { data: al } = await old
    .from("audit_log")
    .select("*")
    .in("document_id", docIds)
    .gte("created_at", CUTOFF);
  if (al?.length) {
    const mapped = al.map(a => ({ ...a, actor: remap(a.actor) }));
    const { error } = await neu.from("audit_log").insert(mapped);
    if (error) console.error("  ❌", error.message); else console.log(`  ✅ ${al.length}`);
  } else console.log("  (none)");

  // running_numbers
  console.log("[9] Syncing running_numbers…");
  const { data: rn } = await old.from("running_numbers").select("*");
  if (rn?.length) {
    const { error } = await neu.from("running_numbers").upsert(rn);
    if (error) console.error("  ❌", error.message); else console.log(`  ✅ ${rn.length}`);
  }

  // Storage — copy new photos for affected docs
  console.log("[10] Syncing storage (gr-photos)…");
  let copied = 0;
  for (const id of docIds) {
    for (const kind of ["per_pcs", "per_inner", "per_carton", "issues", "general"]) {
      const prefix = `${id}/${kind}`;
      const { data: files } = await old.storage.from("gr-photos").list(prefix, { limit: 1000 });
      if (!files?.length) continue;
      for (const f of files) {
        if (!f.id) continue; // folder
        const path = `${prefix}/${f.name}`;
        const { data: blob, error: dlErr } = await old.storage.from("gr-photos").download(path);
        if (dlErr) { console.error(`    ❌ download ${path}:`, dlErr.message); continue; }
        const buf = Buffer.from(await blob.arrayBuffer());
        const { error: upErr } = await neu.storage.from("gr-photos").upload(path, buf, {
          contentType: blob.type, upsert: true,
        });
        if (upErr) console.error(`    ❌ upload ${path}:`, upErr.message);
        else copied++;
      }
    }
  }
  console.log(`  ✅ ${copied} files`);

  console.log("\n=== ✅ CATCH-UP COMPLETE ===");
}

main().catch(e => { console.error("\n💥 Fatal:", e); process.exit(1); });
