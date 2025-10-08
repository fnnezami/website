"use client";
import { useState } from "react";

export default function AssistantWidget({ welcome = "Hi!" }: { welcome?: string }) {
  const [open, setOpen] = useState(true);
  const [msgs, setMsgs] = useState<{role:"user"|"assistant";content:string}[]>([
    { role: "assistant", content: welcome },
  ]);
  const [input, setInput] = useState("");

  async function send() {
    const text = input.trim();
    if (!text) return;
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setInput("");
    // placeholder response; wire to /api/assistant/ask later
    setMsgs((m) => [...m, { role: "assistant", content: "I'll be smarter soon 🤖" }]);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-full bg-black text-white px-4 py-2 shadow">
        Chat
      </button>
    );
  }

  return (
    <div className="w-80 rounded-xl border bg-white shadow-lg p-3">
      <div className="flex justify-between items-center">
        <div className="font-medium">Assistant</div>
        <button onClick={() => setOpen(false)} className="text-sm opacity-70 hover:opacity-100">×</button>
      </div>
      <div className="mt-2 h-56 overflow-auto space-y-1 text-sm">
        {msgs.map((m, i) => (
          <div key={i}><b>{m.role === "assistant" ? "Assistant" : "You"}:</b> {m.content}</div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 border rounded px-2 py-1 text-sm"
          placeholder="Type a message…"
        />
        <button onClick={send} className="px-3 py-1 rounded bg-black text-white text-sm">Send</button>
      </div>
    </div>
  );
}
