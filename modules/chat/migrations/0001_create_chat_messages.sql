-- Create chat_messages table for chat module
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id SERIAL PRIMARY KEY,
  openAI_key TEXT,
  rag_file URL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);