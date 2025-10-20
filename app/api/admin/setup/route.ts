import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseServer } from "@/lib/supabase-server"; // service role for secure write

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const adminEmail = body.adminEmail?.toLowerCase() || "";

    const jar = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => jar.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              jar.set(name, value, options);
            });
          },
        },
      }
    );

    // require login
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    // Is there already an admin?
    const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin").limit(1);
    const firstAdmin = (admins?.length ?? 0) === 0;

    const supabaseServer = await getSupabaseServer();

    // If first admin, promote current user
    if (firstAdmin) {
      const { error: upErr } = await supabaseServer // service role bypasses RLS
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", user.id);
      if (upErr) throw upErr;
    }

    // Store settings (you can encrypt body.encrypted if you want)
    const encrypted = {
      OPENAI_API_KEY: body.OPENAI_API_KEY || null,
      N8N_WEBHOOK_URL: body.N8N_WEBHOOK_URL || null,
      GIST_RAW_URL: body.GIST_RAW_URL || null,
      updated_at: new Date().toISOString(),
    };

    const { error: setErr } = await supabaseServer
      .from("settings")
      .upsert({ id: 1, setup_completed: true, encrypted })
      .eq("id", 1);
    if (setErr) throw setErr;

    return NextResponse.json({ ok: true, becameAdmin: firstAdmin });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
