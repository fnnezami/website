import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    // server-only: create supabase client at runtime
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require("@supabase/supabase-js");

    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SERVICE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

    if (!SUPA_URL || !SERVICE_KEY) {
      return NextResponse.json([], { status: 200 });
    }

    const client = createClient(SUPA_URL, SERVICE_KEY);

    const url = new URL(req.url);
    const includeDisabled = url.searchParams.get("includeDisabled") === "1";

    // read all rows from modules table (do not assume installed column exists)
    const { data, error } = await client.from("modules").select("*");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let rows = Array.isArray(data) ? data : [];
    if (!includeDisabled) rows = rows.filter((m: any) => m.enabled !== false);

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}