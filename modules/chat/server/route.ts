export const runtime = "nodejs";

import { Pool } from "pg";

const pool: any =
  (globalThis as any).__chat_pg__ ||
  new Pool({ connectionString: process.env.DATABASE_URL });
(globalThis as any).__chat_pg__ = pool;

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function getConfigRow() {
  const { rows } = await pool.query(
    "SELECT api_key, knowledge_json, system_prompt, model FROM public.chat_settings WHERE id = 1"
  );
  const row = rows[0] || {};
  return {
    apiKey: row.api_key || "",
    knowledge: row.knowledge_json ?? null,
    systemPrompt: row.system_prompt || "",
    model: row.model || "gpt-5.1-mini",
  };
}

async function saveConfigRow(c: {
  apiKey: string | null;
  knowledge: any;
  systemPrompt: string;
  model: string;
}) {
  await pool.query(
    `INSERT INTO public.chat_settings (id, api_key, knowledge_json, system_prompt, model, updated_at)
     VALUES (1, $1, $2, $3, $4, now())
     ON CONFLICT (id) DO UPDATE SET
       api_key = EXCLUDED.api_key,
       knowledge_json = EXCLUDED.knowledge_json,
       system_prompt = EXCLUDED.system_prompt,
       model = EXCLUDED.model,
       updated_at = now()`,
    [c.apiKey, c.knowledge ?? null, c.systemPrompt || "", c.model || "gpt-5.1-mini"]
  );
}

async function handleAsk(text: string) {
  const { rows } = await pool.query(
    "SELECT api_key, knowledge_json, system_prompt, model FROM public.chat_settings WHERE id = 1"
  );
  const cfg = rows[0] || {};
  const apiKey = cfg.api_key as string | undefined;
  const knowledge = cfg.knowledge_json ?? null;
  const systemPrompt =
    (cfg.system_prompt as string | undefined) ||
    "You are an assistant answering questions about my projects and skills using the provided JSON resume.";
  const model = (cfg.model as string | undefined) || "gpt-5.1-mini";

  if (!apiKey) return json({ ok: false, error: "API key not configured." }, 400);

  const kbText = knowledge ? JSON.stringify(knowledge).slice(0, 120000) : "";
  const system =
    kbText ? `${systemPrompt}\n\nKnowledge Base (JSON):\n${kbText}` : systemPrompt;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
      temperature: 0,
    }),
  });

  if (!r.ok) {
    const errText = await r.text().catch(() => String(r.status));
    return json({ ok: false, error: `OpenAI error: ${errText}` }, 502);
  }

  const data = await r.json();
  const reply =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.content?.[0]?.text ??
    "";
  return json({ ok: true, reply });
}

// Default module handler (the modules router should call this)
export default async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    // Normalize and strip trailing slash
    const pathname = url.pathname.replace(/\/+$/, "");

    // Expect incoming paths like: /modules/chat/api/config and /modules/chat/api/ask
    if (pathname.endsWith("/modules/chat/api/config")) {
      if (req.method === "GET") {
        const cfg = await getConfigRow();
        return json({ ok: true, config: cfg });
      }
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({} as any));
        const c = body?.config || {};
        await saveConfigRow({
          apiKey:
            typeof c.apiKey === "string" && c.apiKey.trim() ? c.apiKey : null,
          knowledge: c.knowledge ?? null,
          systemPrompt: typeof c.systemPrompt === "string" ? c.systemPrompt : "",
          model:
            typeof c.model === "string" && c.model.trim()
              ? c.model
              : "gpt-5.1-mini",
        });
        return json({ ok: true });
      }
      return json({ ok: false, error: "Method Not Allowed" }, 405);
    }

    if (pathname.endsWith("/modules/chat/api/ask") && req.method === "POST") {
      const { text } = await req.json().catch(() => ({} as any));
      if (!text || typeof text !== "string")
        return json({ ok: false, error: "Missing text" }, 400);
      return handleAsk(text);
    }

    return new Response("Not found", { status: 404 });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
}