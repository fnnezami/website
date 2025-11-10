import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function partsFor(req: NextRequest) {
  const { pathname } = new URL(req.url);
  const base = "/api/modules/rest-tester";
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  return rest.split("/").filter(Boolean);
}

// GET: list requests, get one, or check-auth
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parts = partsFor(req);
    const onlyEnabled = url.searchParams.get("onlyEnabled") === "1";
    const includeDisabled = url.searchParams.get("includeDisabled") === "1";

    // /check-auth
    if (parts[0] === "check-auth") {
      // TODO: replace with your real admin check
      const cookieHeader = req.headers.get("cookie") || "";
      const isAdmin = /sb-/.test(cookieHeader) || /admin/.test(cookieHeader);
      return NextResponse.json({ isAdmin });
    }

    // /requests
    if (parts[0] === "requests") {
      // /requests/:id
      if (parts.length === 2) {
        const id = parts[1];
        const { data, error } = await supabase
          .from("rest_requests")
          .select("*")
          .eq("id", id)
          .single();
        if (error) throw error;
        return NextResponse.json({ request: data });
      }

      // /requests
      let query = supabase.from("rest_requests").select("*");
      if (onlyEnabled) {
        query = query.eq("enabled", true);
      } else if (!includeDisabled) {
        // default: only enabled unless explicitly asked
        query = query.eq("enabled", true);
      }
      const { data, error } = await query.order("name", { ascending: true });
      if (error) throw error;
      return NextResponse.json({ requests: data || [] });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error("GET error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST: create request at /requests
export async function POST(req: NextRequest) {
  try {
    const parts = partsFor(req);
    if (parts[0] === "requests" && parts.length === 1) {
      const body = await req.json();
      const payload = {
        enabled: true,
        ...body,
      };
      const { data, error } = await supabase
        .from("rest_requests")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ request: data });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error("POST error:", err);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}

// PUT: update request at /requests/:id
export async function PUT(req: NextRequest) {
  try {
    const parts = partsFor(req);
    if (parts[0] === "requests" && parts.length === 2) {
      const id = parts[1];
      const body = await req.json();
      const { data, error } = await supabase
        .from("rest_requests")
        .update(body)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ request: data });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error("PUT error:", err);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
}

// DELETE: delete request at /requests/:id
export async function DELETE(req: NextRequest) {
  try {
    const parts = partsFor(req);
    if (parts[0] === "requests" && parts.length === 2) {
      const id = parts[1];
      const { error } = await supabase.from("rest_requests").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error("DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete request" }, { status: 500 });
  }
}