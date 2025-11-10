"use client";

import { useState } from "react";

export default function DownloadCvButton() {
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/render/resume?format=pdf&download=1", { method: "GET" });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "CV.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "PDF generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="px-3 py-2 text-sm rounded-md bg-black text-white hover:bg-neutral-800 disabled:opacity-50"
      aria-label="Download CV PDF"
    >
      {loading ? "Generating…" : "Download CV (PDF)"}
    </button>
  );
}