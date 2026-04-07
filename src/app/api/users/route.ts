import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSb } from "@supabase/supabase-js";

export async function POST(req: Request) {
  // Verify caller is admin
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { email, password, full_name, role } = body;
  if (!email || !password || !full_name) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Use service role to create user
  const admin = createSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Ensure profile row reflects role (trigger may have used default)
  await admin
    .from("profiles")
    .update({ full_name, role })
    .eq("id", data.user.id);

  return NextResponse.json({ ok: true, user: data.user });
}
