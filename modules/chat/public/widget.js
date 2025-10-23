(function () {
  // ---------- Config ----------
  var CONFIG_URL = "/modules/chat/api/config";
  var POS_KEY = "chatWidget.btnPos";
  var SIZE_KEY = "chatWidget.size"; // added

  // ---------- Runtime settings (filled from API) ----------
  var API_KEY = "";
  var MODEL = "gpt-4o-mini";
  var SYSTEM_PROMPT = "";
  var KNOWLEDGE_TEXT = "";
  var ready = false;

  // ---------- Styles ----------
  var css = `
  .cw-btn {
    position: fixed; right: 20px; bottom: 20px; z-index: 99999;
    width: 54px; height: 54px; border-radius: 999px;
    background: var(--primary, #0b66ff);
    color: #fff; border: 1px solid rgba(255,255,255,.15);
    box-shadow: 0 8px 22px rgba(0,0,0,.20);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 0; user-select: none; touch-action: none;
    backdrop-filter: saturate(140%) blur(2px);
  }
  .cw-btn:hover { filter: brightness(1.03); transform: translateZ(0); }
  .cw-btn svg { width: 26px; height: 26px; }

  .cw-wrap {
    position: fixed; z-index: 99999;
    width: min(380px, 92vw); height: 520px; max-height: 78vh;
    background: var(--surface, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb); border-radius: 14px;
    box-shadow: 0 16px 42px rgba(0,0,0,.18); display: none; flex-direction: column; overflow: hidden;
    right: 20px; bottom: 84px;
  }
  .cw-wrap.open { display: flex; }

  .cw-head {
    height: 50px; display: flex; align-items: center; gap: 10px;
    padding: 0 12px; border-bottom: 1px solid var(--border-color, #e5e7eb);
    background: var(--surface-2, linear-gradient(180deg, #f9fafb 0%, #ffffff 100%));
    font: 600 14px/1.2 system-ui, sans-serif; color: var(--text-color, #111827);
  }
  .cw-head .cw-title { font-weight: 700; }
  .cw-close { appearance: none; background: transparent; border: none; cursor: pointer; font-size: 18px; color: #6b7280; margin-left: auto; }
  .cw-body { flex: 1; overflow: auto; padding: 12px; background: var(--surface, #fff); }
  .cw-row { display: flex; margin: 8px 0; }
  .cw-row.user { justify-content: flex-end; }
  .cw-row.assistant { justify-content: flex-start; }
  .cw-bubble {
    max-width: 80%; padding: 10px 12px; border-radius: 12px;
    font: 14px/1.45 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }
  .cw-bubble.user { background: var(--primary, #0b66ff); color: #fff; border: 1px solid rgba(255,255,255,.12); white-space: pre-wrap; }
  .cw-bubble.assistant { background: var(--bubble-bg, #f6f7fb); color: var(--text-color, #0f172a); border: 1px solid var(--border-color, #e5e7eb); white-space: normal; }
  .cw-bubble.assistant h1,.cw-bubble.assistant h2,.cw-bubble.assistant h3,.cw-bubble.assistant h4 { margin: 0.4em 0 0.3em; }
  .cw-bubble.assistant p { margin: 0.4em 0; }
  .cw-bubble.assistant ul, .cw-bubble.assistant ol { margin: 0.4em 0 0.4em 1.2em; }
  .cw-bubble.assistant li { margin: 0.2em 0; }
  .cw-bubble.assistant a { color: var(--primary, #0b66ff); text-decoration: underline; }
  .cw-bubble.assistant code { background: #f1f5f9; padding: 0 4px; border-radius: 4px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12.5px; }
  .cw-bubble.assistant pre { background: #0f172a; color: #e2e8f0; padding: 10px; border-radius: 8px; overflow: auto; }
  .cw-bubble.assistant pre code { background: transparent; color: inherit; padding: 0; }
  .cw-bubble.assistant blockquote { border-left: 3px solid var(--border-color, #e5e7eb); margin: 0.4em 0; padding: 0.1em 0 0.1em 10px; color: #334155; }
  .cw-foot { border-top: 1px solid var(--border-color, #e5e7eb); padding: 10px; display: flex; gap: 8px; background: var(--surface, #ffffff); }
  .cw-input { flex: 1; padding: 10px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 10px; font-size: 14px; outline: none; background: var(--input-bg, #fff); color: var(--text-color, #0f172a); }
  .cw-send { padding: 10px 12px; border-radius: 10px; background: var(--primary, #0b66ff); color: #fff; border: none; cursor: pointer; font-size: 14px; }
  .cw-send[disabled] { background: #93c5fd; cursor: default; }
  .cw-hint { color: #6b7280; font: 12px/1.2 system-ui, sans-serif; margin: 6px 10px 10px; }

  /* Obvious resize corner */
  .cw-resize {
    position: absolute; right: 4px; bottom: 4px;
    width: 22px; height: 22px; cursor: se-resize; opacity: .95;
    clip-path: polygon(100% 0, 100% 100%, 0 100%);
    background:
      repeating-linear-gradient(
        135deg,
        rgba(0,0,0,.28) 0 2px,
        transparent 2px 6px
      ),
      var(--surface-2, #eef2ff);
    border: 1px solid var(--border-color, #dbe3ee);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.4);
  }
  .cw-resize:hover { filter: brightness(1.06); }
  `;
  var style = document.createElement("style");
  style.setAttribute("data-chat-widget", "true");
  style.textContent = css;
  document.head.appendChild(style);

  // ---------- DOM ----------
  var btn = document.createElement("button");
  btn.className = "cw-btn";
  btn.title = "Chat";
  btn.setAttribute("aria-label", "Open chat");
  // cleaner chat icon (outline bubble + dots)
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M6 6.5C6 5.1 7.8 4 10 4h4c2.2 0 4 1.1 4 2.5v5c0 1.4-1.8 2.5-4 2.5h-1.7a1 1 0 0 0-.66.24l-3.7 3.2a.8.8 0 0 1-1.28-.8l.43-1.9H10c-2.2 0-4-1.1-4-2.5v-6Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="10" cy="9.5" r="1.1" fill="currentColor"/>' +
    '<circle cx="14" cy="9.5" r="1.1" fill="currentColor"/>' +
    '</svg>';

  var wrap = document.createElement("div");
  wrap.className = "cw-wrap";

  var head = document.createElement("div");
  head.className = "cw-head";
  var iconWrap = document.createElement("span");
  iconWrap.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3c4.4 0 8 2.9 8 6.5 0 2.1-1.3 4-3.3 5.1l.6 3.1a1 1 0 0 1-1.5 1.1L12 17.8l-3.8 1.1a1 1 0 0 1-1.5-1.1l.6-3.1C5.3 13.5 4 11.6 4 9.5 4 5.9 7.6 3 12 3Z" fill="var(--primary, #0b66ff)" opacity=".12"/><circle cx="9.5" cy="9.5" r="1.1" fill="var(--primary, #0b66ff)"/><circle cx="14.5" cy="9.5" r="1.1" fill="var(--primary, #0b66ff)"/><path d="M8.8 12.8c.9.9 2.1 1.4 3.2 1.4s2.3-.5 3.2-1.4" stroke="var(--primary, #0b66ff)" stroke-width="1.2" stroke-linecap="round"/></svg>';

  var titleEl = document.createElement("div");
  titleEl.className = "cw-title";
  titleEl.textContent = "Chat";

  var close = document.createElement("button");
  close.className = "cw-close";
  close.setAttribute("aria-label", "Close");
  close.innerHTML = "✕";
  head.appendChild(iconWrap);
  head.appendChild(titleEl);
  head.appendChild(close);

  var body = document.createElement("div");
  body.className = "cw-body";

  var foot = document.createElement("div");
  foot.className = "cw-foot";
  var input = document.createElement("textarea");
  input.className = "cw-input";
  input.placeholder = "Type your message…";
  input.rows = 1;
  var send = document.createElement("button");
  send.className = "cw-send";
  send.textContent = "Send";
  send.disabled = true;

  var hint = document.createElement("div");
  hint.className = "cw-hint";
  hint.textContent = "Connecting to OpenAI…";

  // resizer
  var resizer = document.createElement("div");
  resizer.className = "cw-resize";
  resizer.setAttribute("title", "Resize");
  resizer.setAttribute("aria-label", "Resize chat");
  resizer.setAttribute("role", "separator");

  foot.appendChild(input);
  foot.appendChild(send);

  wrap.appendChild(head);
  wrap.appendChild(body);
  wrap.appendChild(foot);
  wrap.appendChild(hint);
  wrap.appendChild(resizer); // added

  document.body.appendChild(btn);
  document.body.appendChild(wrap);

  // ---------- State ----------
  var messages = [];
  var pending = false;
  var suppressClick = false;

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Minimal Markdown -> safe HTML (we escape first, then add a small set of tags)
  function mdToHtml(md) {
    if (!md) return "";
    var s = String(md).replace(/\r\n/g, "\n");

    // Extract fenced code blocks first
    var blocks = [];
    s = s.replace(/```([\w-]+)?\n([\s\S]*?)```/g, function (_m, lang, code) {
      blocks.push({ lang: (lang || "").trim(), code: code });
      return "@@CODE" + (blocks.length - 1) + "@@";
    });

    // Escape everything
    s = escHtml(s);

    // Split to lines and build blocks
    var lines = s.split("\n");
    var out = [];
    var inUl = false, inOl = false, inBlock = false, blockType = null, pOpen = false;

    function closeLists() {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (inOl) { out.push("</ol>"); inOl = false; }
    }
    function closePara() {
      if (pOpen) { out.push("</p>"); pOpen = false; }
    }
    function closeBlocks() { closePara(); closeLists(); if (inBlock) { out.push("</blockquote>"); inBlock = false; } }

    function inlineFmt(t) {
      // Links: [text](url) — allow only http/https
      t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_m, txt, url) {
        try {
          var u = new URL(url, location.origin);
          if (u.protocol === "http:" || u.protocol === "https:") {
            return '<a href="' + escHtml(u.href) + '" rel="noopener noreferrer" target="_blank">' + txt + "</a>";
          }
        } catch {}
        return txt;
      });
      // Bold then italic
      t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      t = t.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
      // Inline code
      t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
      return t;
    }

    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];

      // Headings
      var mH = /^(#{1,6})\s+(.*)$/.exec(L);
      if (mH) {
        closeBlocks();
        var level = mH[1].length;
        out.push("<h" + level + ">" + inlineFmt(mH[2]) + "</h" + level + ">");
        continue;
      }

      // Blockquote
      var mQ = /^>\s?(.*)$/.exec(L);
      if (mQ) {
        closePara(); closeLists();
        if (!inBlock) { out.push("<blockquote>"); inBlock = true; }
        out.push("<p>" + inlineFmt(mQ[1]) + "</p>");
        continue;
      } else {
        if (inBlock && L.trim() === "") {
          out.push("</blockquote>"); inBlock = false;
          continue;
        }
      }

      // Unordered list
      var mUl = /^\s*[-*]\s+(.*)$/.exec(L);
      if (mUl) {
        closePara();
        if (!inUl) { closeLists(); out.push("<ul>"); inUl = true; }
        out.push("<li>" + inlineFmt(mUl[1]) + "</li>");
        continue;
      }

      // Ordered list
      var mOl = /^\s*\d+\.\s+(.*)$/.exec(L);
      if (mOl) {
        closePara();
        if (!inOl) { closeLists(); out.push("<ol>"); inOl = true; }
        out.push("<li>" + inlineFmt(mOl[1]) + "</li>");
        continue;
      }

      // Blank line
      if (L.trim() === "") {
        closeBlocks();
        continue;
      }

      // Paragraph (accumulate)
      if (!pOpen) { closeLists(); out.push("<p>"); pOpen = true; }
      out.push(inlineFmt(L) + "<br/>");
    }
    closeBlocks();

    // Restore code blocks
    var html = out.join("\n");
    html = html.replace(/@@CODE(\d+)@@/g, function (_m, idx) {
      var b = blocks[Number(idx)];
      var codeEsc = escHtml(b.code.replace(/\n$/, "")); // remove trailing newline
      var lang = b.lang ? ' class="language-' + escHtml(b.lang) + '"' : "";
      return "<pre><code" + lang + ">" + codeEsc + "</code></pre>";
    });

    return html;
  }

  function row(role, text) {
    var r = document.createElement("div");
    r.className = "cw-row " + role;
    var b = document.createElement("div");
    b.className = "cw-bubble " + role;
    if (role === "assistant") {
      b.innerHTML = mdToHtml(text);
    } else {
      b.textContent = text;
    }
    r.appendChild(b);
    return r;
  }
  function scrollBottom() {
    body.scrollTo({ top: body.scrollHeight, behavior: "smooth" });
  }
  function addMessage(role, text) {
    messages.push({ role: role, content: text });
    body.appendChild(row(role, text));
    scrollBottom();
  }
  function setPending(v) {
    pending = v;
    send.disabled = v || !input.value.trim();
  }
  function lastExchanges(limit) {
    var start = Math.max(0, messages.length - limit);
    return messages.slice(start);
  }

  // ---------- Config + OpenAI ----------
  function buildSystem(systemPrompt, knowledgeText) {
    var header = (systemPrompt && systemPrompt.trim()) || "You are a helpful assistant.";
    var out = header + "\n\nUse the provided Knowledge Base to answer. If unknown, say you don't know.";
    if (!knowledgeText) return out;
    var kb = String(knowledgeText);
    var MAX = 20000;
    if (kb.length > MAX) kb = kb.slice(0, MAX) + "\n... [truncated]";
    return out + "\n\nKnowledge Base (JSON):\n" + kb;
  }
  function mapHistoryForChat(history, nextUserText, system) {
    var msgs = [{ role: "system", content: system }];
    history.forEach(function (m) {
      if (m.role === "user" || m.role === "assistant") msgs.push({ role: m.role, content: m.content });
    });
    msgs.push({ role: "user", content: nextUserText });
    return msgs;
  }
  function mapHistoryForResponses(history, nextUserText, system) {
    var parts = [{ role: "system", content: system }];
    history.forEach(function (m) {
      if (m.role === "user" || m.role === "assistant") parts.push({ role: m.role, content: m.content });
    });
    parts.push({ role: "user", content: nextUserText });
    return parts;
  }
  function isResponsesModel(id) {
    id = String(id || "").toLowerCase();
    return id.startsWith("gpt-5") || id.startsWith("gpt-4.1") || id.startsWith("gpt-4o");
  }
  function extractFromResponses(j) {
    if (!j) return "";
    if (typeof j.output_text === "string" && j.output_text.trim()) return j.output_text;
    if (Array.isArray(j.output)) {
      var parts = [];
      j.output.forEach(function (o) {
        var content = (o && o.content) || [];
        content.forEach(function (c) {
          if (c && c.type === "output_text" && c.text && c.text.value) parts.push(c.text.value);
          else if (c && c.text && c.text.value) parts.push(c.text.value);
          else if (typeof c?.text === "string") parts.push(c.text);
        });
      });
      if (parts.length) return parts.join("");
    }
    if (j?.response?.output_text) return j.response.output_text;
    return "";
  }
  function extractFromChat(j) {
    try {
      var choice = j && j.choices && j.choices[0];
      var msg = choice && choice.message;
      if (msg && typeof msg.content === "string" && msg.content.trim()) return msg.content;
      if (msg && Array.isArray(msg.content)) {
        return msg.content.map(function (p){ return p?.text || p?.content || ""; }).join("");
      }
      if (choice && choice.finish_reason === "content_filter") {
        return "The response was filtered by safety settings.";
      }
    } catch {}
    return "";
  }

  async function askOpenAI(text) {
    if (!API_KEY) throw new Error("OpenAI API key not configured.");
    var system = buildSystem(SYSTEM_PROMPT, KNOWLEDGE_TEXT);
    var useResponses = isResponsesModel(MODEL);

    if (useResponses) {
      var r1 = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + API_KEY },
        body: JSON.stringify({ model: MODEL, input: mapHistoryForResponses(lastExchanges(10), text, system) }),
      });
      var raw1 = await r1.text().catch(function(){ return ""; });
      if (!r1.ok) throw new Error(raw1 || ("HTTP " + r1.status));
      var j1 = raw1 ? JSON.parse(raw1) : {};
      var out = extractFromResponses(j1);
      if (!out) out = "No response from model.";
      return String(out);
    } else {
      var r2 = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + API_KEY },
        body: JSON.stringify({ model: MODEL, messages: mapHistoryForChat(lastExchanges(10), text, system), temperature: 0.2 }),
      });
      var raw2 = await r2.text().catch(function(){ return ""; });
      if (!r2.ok) throw new Error(raw2 || ("HTTP " + r2.status));
      var j2 = raw2 ? JSON.parse(raw2) : {};
      var msg = extractFromChat(j2);
      if (!msg) msg = "No response from model.";
      return String(msg);
    }
  }

  async function loadConfig() {
    try {
      var res = await fetch(CONFIG_URL, { method: "GET", credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var cfg = await res.json();
      API_KEY = String(cfg.apiKey || "");
      MODEL = String(cfg.model || MODEL);
      SYSTEM_PROMPT = String(cfg.systemPrompt || "");
      if (cfg.knowledge != null) {
        try { KNOWLEDGE_TEXT = typeof cfg.knowledge === "string" ? cfg.knowledge : JSON.stringify(cfg.knowledge, null, 2); }
        catch { KNOWLEDGE_TEXT = String(cfg.knowledge); }
      }
      hint.textContent = API_KEY ? "Connected to OpenAI." : "OpenAI key missing in config.";
    } catch (e) {
      hint.textContent = "Failed to load chat config.";
    } finally {
      ready = true;
      send.disabled = !input.value.trim();
    }
  }

  // ---------- Size (resizable) ----------
  function loadSize() {
    try { return JSON.parse(localStorage.getItem(SIZE_KEY) || "null"); } catch { return null; }
  }
  function saveSize(sz) {
    try { localStorage.setItem(SIZE_KEY, JSON.stringify(sz)); } catch {}
  }
  function applySize(sz) {
    if (!sz) return;
    wrap.style.width = sz.w + "px";
    wrap.style.height = sz.h + "px";
  }
  var savedSize = loadSize();
  if (savedSize && typeof savedSize.w === "number" && typeof savedSize.h === "number") {
    applySize({
      w: Math.min(Math.max(savedSize.w, 300), Math.min(window.innerWidth * 0.92, 900)),
      h: Math.min(Math.max(savedSize.h, 320), Math.min(window.innerHeight * 0.78, 900)),
    });
  }

  function onResizeDown(e) {
    e.preventDefault();
    var startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    var startY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    var rect = wrap.getBoundingClientRect();
    var startW = rect.width;
    var startH = rect.height;

    function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

    function onMove(ev) {
      var cx = ev.clientX || (ev.touches && ev.touches[0].clientX) || startX;
      var cy = ev.clientY || (ev.touches && ev.touches[0].clientY) || startY;
      var dx = cx - startX;
      var dy = cy - startY;
      var maxW = Math.min(window.innerWidth - 32, 900);
      var maxH = Math.min(window.innerHeight - 32, 900);
      var w = clamp(startW + dx, 300, maxW);
      var h = clamp(startH + dy, 320, maxH);
      wrap.style.width = w + "px";
      wrap.style.height = h + "px";
    }
    function onUp() {
      var r = wrap.getBoundingClientRect();
      saveSize({ w: Math.round(r.width), h: Math.round(r.height) });
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    }

    window.addEventListener("mousemove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  }
  resizer.addEventListener("mousedown", onResizeDown);
  resizer.addEventListener("touchstart", onResizeDown, { passive: false });

  // ---------- Draggable button ----------
  function loadBtnPos() {
    try { return JSON.parse(localStorage.getItem(POS_KEY) || "null"); } catch { return null; }
  }
  function saveBtnPos(pos) {
    try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {}
  }
  function applyBtnPos(pos) {
    if (!pos) return;
    btn.style.left = pos.x + "px";
    btn.style.top = pos.y + "px";
    btn.style.right = "";
    btn.style.bottom = "";
  }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function positionWrapNearButton() {
    // Position the chat window near the button (above if possible, else below)
    if (!wrap.classList.contains("open")) return;
    var bw = btn.offsetWidth || 52, bh = btn.offsetHeight || 52;
    var br = btn.getBoundingClientRect();
    var ww = window.innerWidth, wh = window.innerHeight;

    // Measure wrap (might be open)
    var wr = wrap.getBoundingClientRect();
    var wW = wr.width || Math.min(360, ww * 0.92);
    var wH = wr.height || Math.min(520, wh * 0.7);

    var left = clamp(br.left + bw - wW, 8, ww - wW - 8);
    var top = br.top - wH - 12;
    if (top < 8) top = clamp(br.bottom + 12, 8, wh - wH - 8);

    wrap.style.left = left + "px";
    wrap.style.top = top + "px";
    wrap.style.right = "";
    wrap.style.bottom = "";
  }

  var savedPos = loadBtnPos();
  if (savedPos && typeof savedPos.x === "number" && typeof savedPos.y === "number") {
    applyBtnPos(savedPos);
  }

  var dragState = null;
  function onPointerDown(e) {
    // Left mouse or touch
    if (e.type === "mousedown" && e.button !== 0) return;
    suppressClick = false;

    var rect = btn.getBoundingClientRect();
    dragState = {
      sx: e.clientX || (e.touches && e.touches[0].clientX) || 0,
      sy: e.clientY || (e.touches && e.touches[0].clientY) || 0,
      bx: rect.left,
      by: rect.top,
      moved: false,
    };

    window.addEventListener("mousemove", onPointerMove, { passive: false });
    window.addEventListener("touchmove", onPointerMove, { passive: false });
    window.addEventListener("mouseup", onPointerUp, { passive: false });
    window.addEventListener("touchend", onPointerUp, { passive: false });
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (!dragState) return;
    var cx = e.clientX || (e.touches && e.touches[0].clientX) || dragState.sx;
    var cy = e.clientY || (e.touches && e.touches[0].clientY) || dragState.sy;
    var dx = cx - dragState.sx;
    var dy = cy - dragState.sy;
    if (!dragState.moved && (Math.abs(dx) + Math.abs(dy) > 3)) {
      dragState.moved = true;
      suppressClick = true;
    }
    if (dragState.moved) {
      var nx = clamp(dragState.bx + dx, 8, window.innerWidth - (btn.offsetWidth || 52) - 8);
      var ny = clamp(dragState.by + dy, 8, window.innerHeight - (btn.offsetHeight || 52) - 8);
      btn.style.left = nx + "px";
      btn.style.top = ny + "px";
      btn.style.right = "";
      btn.style.bottom = "";
      positionWrapNearButton();
    }
    e.preventDefault();
  }
  function onPointerUp(e) {
    window.removeEventListener("mousemove", onPointerMove);
    window.removeEventListener("touchmove", onPointerMove);
    window.removeEventListener("mouseup", onPointerUp);
    window.removeEventListener("touchend", onPointerUp);
    if (dragState && dragState.moved) {
      // Persist position
      var r = btn.getBoundingClientRect();
      saveBtnPos({ x: r.left, y: r.top });
      positionWrapNearButton();
    }
    dragState = null;
  }
  btn.addEventListener("mousedown", onPointerDown);
  btn.addEventListener("touchstart", onPointerDown, { passive: false });

  // ---------- Events ----------
  function sendNow() {
    var text = (input.value || "").trim();
    if (!text || pending) return;

    function doSend() {
      if (!API_KEY) {
        addMessage("assistant", "Error: OpenAI API key not configured.");
        return;
      }
      addMessage("user", text);
      input.value = "";
      setPending(true);

      var thinkingEl = row("assistant", "Thinking…");
      body.appendChild(thinkingEl);
      scrollBottom();

      askOpenAI(text)
        .then(function (reply) {
          body.removeChild(thinkingEl);
          addMessage("assistant", reply || "(no reply)");
        })
        .catch(function (err) {
          body.removeChild(thinkingEl);
          addMessage("assistant", "Error: " + ((err && err.message) || "Failed."));
        })
        .finally(function () {
          setPending(false);
        });
    }

    if (!ready) {
      loadConfig().then(doSend);
    } else {
      doSend();
    }
  }

  send.addEventListener("click", sendNow);
  input.addEventListener("input", function () {
    input.style.height = "auto";
    input.style.height = Math.min(120, input.scrollHeight) + "px";
    send.disabled = pending || !input.value.trim();
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendNow();
    }
  });

  function toggleOpen() {
    if (wrap.classList.contains("open")) {
      wrap.classList.remove("open");
    } else {
      wrap.classList.add("open");
      // ensure position near button
      positionWrapNearButton();
      setTimeout(positionWrapNearButton, 0);
    }
  }

  btn.addEventListener("click", function () {
    if (suppressClick) { suppressClick = false; return; }
    toggleOpen();
    if (wrap.classList.contains("open")) {
      setTimeout(function () { input.focus(); }, 0);
    }
  });

  close.addEventListener("click", function () { wrap.classList.remove("open"); });

  window.addEventListener("resize", function () {
    // Keep button inside viewport
    var r = btn.getBoundingClientRect();
    var nx = clamp(r.left, 8, window.innerWidth - (btn.offsetWidth || 52) - 8);
    var ny = clamp(r.top, 8, window.innerHeight - (btn.offsetHeight || 52) - 8);
    btn.style.left = nx + "px"; btn.style.top = ny + "px"; btn.style.right = ""; btn.style.bottom = "";
    positionWrapNearButton();
  });

  // ---------- Init ----------
  addMessage("assistant", "Hi! Ask me anything.");
  loadConfig();
})();