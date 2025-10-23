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

function isResponsesModel(id: string) {
  const m = String(id || "").toLowerCase();
  return m.startsWith("gpt-5") || m.startsWith("gpt-4.1") || m.startsWith("gpt-4o");
}

type HistMsg = { role: "user" | "assistant"; content: string };

function toResponsesInput(history: HistMsg[], userText: string, systemPrompt?: string) {
  const input: Array<{
    role: "system" | "developer" | "user" | "assistant" | "tool";
    content: Array<{ type: "text" | "input_text"; text: string }>;
  }> = [];
  if (systemPrompt && systemPrompt.trim()) {
    input.push({ role: "system", content: [{ type: "text", text: systemPrompt }] });
  }
  for (const m of history) {
    input.push({ role: m.role, content: [{ type: "text", text: m.content }] });
  }
  input.push({ role: "user", content: [{ type: "input_text", text: userText }] });
  return input;
}

function extractFromResponses(j: any): string {
  if (!j) return "";
  if (typeof j.output_text === "string" && j.output_text.trim()) return j.output_text;
  if (Array.isArray(j.output)) {
    const parts: string[] = [];
    j.output.forEach((o: any) => {
      const content = (o && o.content) || [];
      content.forEach((c: any) => {
        if (c?.type === "output_text" && c?.text?.value) parts.push(c.text.value);
        else if (c?.text?.value) parts.push(c.text.value);
        else if (typeof c?.text === "string") parts.push(c.text);
      });
    });
    if (parts.length) return parts.join("");
  }
  if (j?.response?.output_text) return j.response.output_text;
  return "";
}

// Call OpenAI using the model saved in settings.
// For most models, Chat Completions is fine. If you use “gpt-5.*”, Responses API is preferred.
export async function askOpenAI(messages: Msg[]): Promise<string> {
  "use server";
  const { apiKey, model, systemPrompt, knowledge } = await getSettings();
  if (!apiKey) throw new Error("OpenAI API key is not configured.");

  const openai = new OpenAI({ apiKey });

  // Build messages with system + KB
  const systemContent = buildSystemContent(systemPrompt, knowledge);

  const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  chatMessages.push({ role: "system", content: systemContent });
  for (const m of messages) {
    if (m.role === "user" || m.role === "assistant" || m.role === "system") {
      chatMessages.push({ role: m.role, content: m.content });
    } else if (m.role === "developer") {
      // Chat Completions doesn’t support 'developer'; map to 'system'
      chatMessages.push({ role: "system", content: m.content });
    }
    // Skip 'tool' here (would require tool_call_id)
  }

  // Use Chat Completions
  const res = await openai.chat.completions.create({
    model,
    messages: chatMessages,
    temperature: 0.2,
  });

  return res.choices?.[0]?.message?.content || "(no reply)";
}