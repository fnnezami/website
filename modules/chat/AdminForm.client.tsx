"use client";

import React, { useEffect, useRef, useState, useActionState } from "react";
import { useFormStatus } from "react-dom";

type Cfg = {
  apiKey: string;
  model: string;
  systemPrompt: string;
  knowledge: any;
};
type FormState = { ok: boolean | null; message?: string; error?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: "8px 12px",
        borderRadius: 6,
        background: pending ? "#6b8dff" : "#0b66ff",
        color: "#fff",
        border: "none",
        cursor: pending ? "default" : "pointer",
      }}
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

function FileToTextarea({ onText }: { onText: (text: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      onText(text);
      setFileName(f.name);
    } catch {
      onText("");
      alert("Failed to read file.");
      setFileName(null);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        onChange={onFile}
        style={{ display: "none" }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{
          padding: "6px 10px",
          borderRadius: 6,
          background: "#f3f4f6",
          border: "1px solid #e5e7eb",
          color: "#111827",
          cursor: "pointer",
        }}
      >
        Choose JSON file…
      </button>
      <span style={{ fontSize: 12, color: fileName ? "#111827" : "#666" }}>
        {fileName ? `Selected: ${fileName}` : "Upload a JSON file to fill the Knowledge box."}
      </span>
    </div>
  );
}

export default function AdminForm({
  initialCfg,
  saveAction,
  listModels,
}: {
  initialCfg: Cfg;
  saveAction: (prev: FormState, fd: FormData) => Promise<FormState>;
  listModels: (apiKeyOverride?: string) => Promise<{ ok: boolean; models?: string[]; error?: string }>;
}) {
  const [state, action] = useActionState(saveAction, { ok: null } as FormState);

  const [apiKey, setApiKey] = useState(initialCfg.apiKey || "");
  const [model, setModel] = useState(initialCfg.model || "");
  const [systemPrompt, setSystemPrompt] = useState(initialCfg.systemPrompt || "");
  const [knowledgeText, setKnowledgeText] = useState(
    initialCfg.knowledge ? JSON.stringify(initialCfg.knowledge, null, 2) : ""
  );

  const [availableModels, setAvailableModels] = useState<string[] | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Auto-clear success message after 2s
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (state.ok && state.message) {
      setFlash(state.message);
      const t = setTimeout(() => setFlash(null), 2000);
      return () => clearTimeout(t);
    }
  }, [state.ok, state.message]);

  async function loadModels() {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const res = await listModels(apiKey);
      if (!res.ok) throw new Error(res.error || "Failed to load models.");
      const names = res.models || [];
      setAvailableModels(names);
      // If current model not in list, keep it but show a hint
      if (names.length && (!model || !names.includes(model))) {
        // Pick a reasonable default (first in list)
        setModel(names[0]);
      }
    } catch (e: any) {
      setModelsError(e?.message || "Failed to load models.");
    } finally {
      setModelsLoading(false);
    }
  }

  useEffect(() => {
    // Load once on mount if there is an apiKey available
    if ((apiKey && apiKey.trim()) || (!apiKey && initialCfg.apiKey)) {
      loadModels().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modelNotInList =
    !!availableModels && !!model && availableModels.indexOf(model) === -1;

  return (
    <div style={{ padding: 12, maxWidth: 760 }}>
      <h2 style={{ margin: "0 0 8px 0" }}>Chat Module — Admin</h2>
      <p style={{ margin: "0 0 12px 0", color: "#555" }}>
        Configure the OpenAI connection and knowledge base used by the chat widget.
      </p>

      {state.error && (
        <div style={{ marginBottom: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
          {state.error}
        </div>
      )}
      {flash && <div style={{ marginBottom: 12, color: "green" }}>{flash}</div>}

      <form action={action}>
        <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
          OpenAI API key
        </label>
        <input
          name="apiKey"
          type="password"
          placeholder="sk-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 6,
            border: "1px solid #e6e6e6",
            marginBottom: 12,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <label style={{ fontSize: 13 }}>Model</label>
          <button
            type="button"
            onClick={loadModels}
            disabled={modelsLoading || (!apiKey.trim() && !initialCfg.apiKey)}
            title="Fetch models available to this API key"
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              background: "#f3f4f6",
              color: "#111827",
              border: "1px solid #e5e7eb",
              cursor: modelsLoading ? "default" : "pointer",
              fontSize: 12,
            }}
          >
            {modelsLoading ? "Loading…" : "Load models"}
          </button>
        </div>

        <select
          name="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 6,
            border: "1px solid #e6e6e6",
            marginBottom: 8,
          }}
        >
          {availableModels && availableModels.length > 0 ? (
            availableModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))
          ) : (
            <option value={model || ""}>{model || "(select a model)"}</option>
          )}
        </select>

        {modelsError && (
          <div style={{ marginBottom: 8, color: "crimson", fontSize: 12 }}>{modelsError}</div>
        )}
        {modelNotInList && (
          <div style={{ marginBottom: 8, color: "#92400e", fontSize: 12 }}>
            The saved model isn’t available on this API key. Choose another and Save.
          </div>
        )}

        <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
          System prompt
        </label>
        <textarea
          name="systemPrompt"
          rows={4}
          placeholder="Guide the assistant behavior…"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 6,
            border: "1px solid #e6e6e6",
            marginBottom: 12,
          }}
        />

        <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
          Knowledge base (JSON)
        </label>
        <FileToTextarea onText={setKnowledgeText} />
        <textarea
          name="knowledge"
          rows={10}
          placeholder='{ "name": "...", "projects": [ ... ] }'
          value={knowledgeText}
          onChange={(e) => setKnowledgeText(e.target.value)}
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 6,
            border: "1px solid #e6e6e6",
            marginBottom: 12,
            fontFamily: "ui-monospace, Menlo, Consolas, monospace",
          }}
        />

        <SubmitButton />
      </form>
    </div>
  );
}