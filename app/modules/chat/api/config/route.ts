import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool: any =
  (globalThis as any).__chat_pg__ ||
  new Pool({ connectionString: process.env.DATABASE_URL });
(globalThis as any).__chat_pg__ = pool;

export async function GET() {
  try {
    const { rows } = await pool.query(
      "SELECT api_key, knowledge_json, system_prompt, model FROM public.chat_settings WHERE id = 1"
    );
    const row = rows[0] || {};

    const body = {
      // Exposes values for the widget to use directly
      apiKey: row?.api_key || process.env.OPENAI_API_KEY || "",
      model: row?.model || "gpt-4o-mini",
      systemPrompt: row?.system_prompt || "",
      knowledge: row?.knowledge_json ?? null,
    };

    return NextResponse.json(body, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load chat config." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}