-- Create chat_messages table for chat module
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);