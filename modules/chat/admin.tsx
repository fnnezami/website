export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Pool } from "pg";
import AdminForm from "././AdminForm.client";
import OpenAI from "openai";

type Cfg = {
  apiKey: string;
  model: string;
  systemPrompt: string;
  knowledge: any;
};
type FormState = { ok: boolean | null; message?: string; error?: string };

// Keep a single pool across hot reloads
const pool: any =
  (globalThis as any).__chat_pg__ ||
  new Pool({ connectionString: process.env.DATABASE_URL });
(globalThis as any).__chat_pg__ = pool;

async function getConfig(): Promise<Cfg> {
  const { rows } = await pool.query(
    "SELECT api_key, knowledge_json, system_prompt, model FROM public.chat_settings WHERE id = 1"
  );
  const row = rows[0] || {};
  return {
    apiKey: row?.api_key || "",
    knowledge: row?.knowledge_json ?? null,
    systemPrompt: row?.system_prompt || "",
    model: row?.model || "gpt-5.1-mini",
  };
}

export async function saveAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  "use server";
  try {
    const apiKeyRaw = formData.get("apiKey");
    const modelRaw = formData.get("model");
    const promptRaw = formData.get("systemPrompt");
    const knowledgeRaw = formData.get("knowledge");

    const apiKey =
      typeof apiKeyRaw === "string" && apiKeyRaw.trim() ? apiKeyRaw.trim() : null;
    const model =
      typeof modelRaw === "string" && modelRaw.trim() ? modelRaw.trim() : "gpt-5.1-mini";
    const systemPrompt = typeof promptRaw === "string" ? promptRaw : "";

    let knowledge: any = null;
    if (typeof knowledgeRaw === "string" && knowledgeRaw.trim()) {
      try {
        knowledge = JSON.parse(knowledgeRaw);
      } catch {
        return { ok: false, error: "Knowledge must be valid JSON." };
      }
    }

    await pool.query(
      `INSERT INTO public.chat_settings (id, api_key, knowledge_json, system_prompt, model, updated_at)
       VALUES (1, $1, $2, $3, $4, now())
       ON CONFLICT (id) DO UPDATE SET
         api_key = EXCLUDED.api_key,
         knowledge_json = EXCLUDED.knowledge_json,
         system_prompt = EXCLUDED.system_prompt,
         model = EXCLUDED.model,
         updated_at = now()`,
      [apiKey, knowledge, systemPrompt, model]
    );

    return { ok: true, message: "Saved successfully." };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Failed to save." };
  }
}

export async function listModelsAction(apiKeyOverride?: string): Promise<{ ok: boolean; models?: string[]; error?: string }> {
  "use server";
  try {
    const cfg = await getConfig();
    const apiKey =
      (apiKeyOverride && apiKeyOverride.trim()) ||
      cfg.apiKey ||
      process.env.OPENAI_API_KEY ||
      "";
    if (!apiKey) return { ok: false, error: "OpenAI API key is not configured." };

    const client = new OpenAI({ apiKey });
    const list = await client.models.list();
    const names = (list?.data || [])
      .map((m: any) => m?.id)
      .filter(Boolean)
      .sort((a: string, b: string) => a.localeCompare(b));

    return { ok: true, models: names };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Failed to list models." };
  }
}

export default async function ChatAdmin() {
  const cfg = await getConfig();
  return <AdminForm initialCfg={cfg} saveAction={saveAction} listModels={listModelsAction} />;
}