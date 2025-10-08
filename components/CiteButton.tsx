"use client";

import { useState } from "react";

export default function CiteButton({ bib }: { bib: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(bib);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      // fallback: show prompt
      window.prompt("Copy BibLaTeX:", bib);
    }
  }

  return (
    <button
      onClick={onCopy}
      className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50 active:scale-[0.99]"
      title="Copy BibLaTeX to clipboard"
      type="button"
    >
      {copied ? "Copied!" : "Cite"}
    </button>
  );
}
