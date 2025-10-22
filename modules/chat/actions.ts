export const runtime = "nodejs";

import { Pool } from "pg";
import OpenAI from "openai";

type Msg = { role: "system" | "user" | "assistant" | "tool" | "developer"; content: string };

const pool: any =
  (globalThis as any).__chat_pg__ ||
  new Pool({ connectionString: process.env.DATABASE_URL });
(globalThis as any).__chat_pg__ = pool;

async function getSettings() {
  const { rows } = await pool.query(
    "SELECT api_key, knowledge_json, system_prompt, model FROM public.chat_settings WHERE id = 1"
  );
  const row = rows[0] || {};
  return {
    apiKey: row?.api_key || process.env.OPENAI_API_KEY || "",
    model: row?.model || "gpt-4o-mini",
    systemPrompt: row?.system_prompt || "",
    knowledge: row?.knowledge_json ?? null,
  };
}

function buildSystemContent(systemPrompt: string, knowledge: any): string {
  const header =
    (systemPrompt?.trim() || "You are a helpful assistant.") +
    "\n\nUse the provided Knowledge Base to answer accurately. If the KB lacks info, say so.\n";
  if (!knowledge) return header;

  // Stringify and cap size to avoid huge prompts
  let kb = "";
  try {
    kb = JSON.stringify(knowledge, null, 2);
  } catch {
    kb = String(knowledge);
  }
  const MAX_CHARS = 20000;
  if (kb.length > MAX_CHARS) {
    kb = kb.slice(0, MAX_CHARS) + "\n... [truncated KB]";
  }
  return `${header}\nKnowledge Base (JSON):\n${kb}`;
}

// Call OpenAI using the model saved in settings.
// For most models, Chat Completions is fine. If you use “gpt-5.*”, Responses API is preferred.
export async function askOpenAI(messages: Msg[]): Promise<string> {
  "use server";
  const { apiKey, model, systemPrompt, knowledge } = await getSettings();
  if (!apiKey) throw new Error("OpenAI API key is not configured.");

  const openai = new OpenAI({ apiKey });

  // Prepend system context with KB
  const systemContent = buildSystemContent(systemPrompt, knowledge);
  const chatMessages = [
    { role: "system" as const, content: systemContent },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  // Prefer Responses API for “gpt-5.*” models, else use Chat Completions
  const useResponses = /^gpt-5/i.test(model);
  if (useResponses) {
    const res = await openai.responses.create({
      model,
      input: chatMessages.map((m) => ({ role: m.role, content: m.content })),
    });
    // SDK exposes a convenience field for text output
    // Fallback to manual extraction if needed.
    // @ts-ignore
    const text: string = (res as any).output_text ?? (
      Array.isArray(res.output)
        ? res.output
            .flatMap((o: any) => (o?.content || []).map((c: any) => c?.text?.value || ""))
            .join("")
        : ""
    );
    return text || "";
  } else {
    const res = await openai.chat.completions.create({
      model,
      messages: chatMessages,
      temperature: 0.2,
    });
    return res.choices?.[0]?.message?.content || "";
  }
}