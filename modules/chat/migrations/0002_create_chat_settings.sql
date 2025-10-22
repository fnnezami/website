-- Holds OpenAI config for the chat module (single-row table)
CREATE TABLE IF NOT EXISTS public.chat_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  api_key TEXT,
  knowledge_json JSONB,
  system_prompt TEXT,
  model TEXT DEFAULT 'gpt-5.1-mini',
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.chat_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;