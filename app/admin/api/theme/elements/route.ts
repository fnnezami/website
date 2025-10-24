export const runtime = "nodejs";

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CSS_FILES = [path.join(ROOT, "app", "globals.css"), path.join(ROOT, "app", "theme-overrides.css")];

// Tags commonly styled
const KNOWN_TAGS = [
  "a","button","label","input","textarea","select","option","progress","meter",
  "table","thead","tbody","tr","th","td","caption",
  "ul","ol","li","dl","dt","dd",
  "blockquote","code","pre","kbd","samp",
  "h1","h2","h3","h4","h5","h6","p","small","mark","hr",
  "figure","figcaption","img","picture","video","audio",
  "details","summary",
  "nav","header","footer","section","article","aside","main"
];

const PREFERRED_CLASS_DEMOS: Record<string, string> = {
  ".btn": "button",
  ".btn-secondary": "button",
  ".prose": "div",
  ".site-header": "header",
  ".skill": "span",
  ".badge": "span",
  ".chip": "span",
  ".tag": "span",
  ".card": "div",
  ".panel": "div",
  ".box": "div",
  ".app-panel": "div",
  ".switch-track": "label",
  ".cw-wrap": "div",
  ".cw-head": "div",
  ".cw-foot": "div",
  ".cw-body": "div",
  ".cw-input": "input",
  ".cw-bubble": "div",
};

export async function GET() {
  let css = "";
  for (const f of CSS_FILES) {
    try { css += (await fs.readFile(f, "utf8")) + "\n"; } catch {}
  }

  // Tags present in selectors
  const foundTags = new Set<string>();
  for (const tag of KNOWN_TAGS) {
    const re = new RegExp(`(^|[\\s\\n>,:~+\\[\\(])${tag}(?=[\\s\\n#.:>+~\\[,\\)])`);
    if (re.test(css)) foundTags.add(tag);
  }

  // Classes present in selectors (top-level simple classes only)
  const classSet = new Set<string>();
  const classRe = /(^|[^\w-])\.([a-zA-Z][\w-]*)(?=[^,{]*\{)/gm;
  let m: RegExpExecArray | null;
  while ((m = classRe.exec(css))) {
    const cls = "." + m[2];
    if (PREFERRED_CLASS_DEMOS[cls]) classSet.add(cls);
  }

  const tags = Array.from(foundTags).sort();
  const classes = Array.from(classSet).sort();
  return NextResponse.json({ tags, classes });
}