// app/api/admin/storage/upload/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const path = String(form.get("path") || "");

    if (!file || !path) {
      return NextResponse.json(
        { ok: false, error: "file and path required" },
        { status: 400 }
      );
    }

    // Create the client *now* (not at module import time)
    const supabase = getSupabaseServer();

    const arrayBuf = await file.arrayBuffer();
    const upload = await supabase.storage
      .from("projects")
      .upload(path, new Uint8Array(arrayBuf), {
        upsert: true,
        contentType: file.type || "application/octet-stream",
      });

    if (upload.error) {
      // Common helpful hints
      // - If you see "Bucket not found": create a public "projects" bucket in Supabase Storage
      // - If you see "new row violates row-level security": ensure your RLS policies allow service role (it bypasses RLS)
      return NextResponse.json(
        { ok: false, error: upload.error.message },
        { status: 500 }
      );
    }

    const { data } = supabase.storage.from("projects").getPublicUrl(path);
    return NextResponse.json(
      { ok: true, publicUrl: data.publicUrl },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
