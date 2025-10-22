import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function renderMarkdownToHtml(md?: string | null): string {
  if (!md) return "";
  const raw = marked.parse(md);
  const str = typeof raw === "string" ? raw : String(raw);
  return DOMPurify.sanitize(str);
}