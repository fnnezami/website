"use client";
import ReactMarkdown from "react-markdown";

export default function MDXContent({ source = "" }: { source?: string }) {
  // Simple Markdown renderer for now (we can swap to MDX later)
  return <div className="prose max-w-none"><ReactMarkdown>{source}</ReactMarkdown></div>;
}
