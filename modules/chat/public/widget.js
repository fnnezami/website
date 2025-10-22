(function () {
  // ---------- Config ----------
  var CONFIG_URL = "/modules/chat/api/config";
  var POS_KEY = "chatWidget.btnPos";

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
    width: 52px; height: 52px; border-radius: 999px;
    background: #0b66ff; color: #fff; border: none; box-shadow: 0 6px 18px rgba(0,0,0,.15);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 22px; user-select: none; touch-action: none;
  }
  .cw-wrap {
    position: fixed; z-index: 99999;
    width: min(360px, 92vw); height: 520px; max-height: 70vh;
    background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
    box-shadow: 0 12px 30px rgba(0,0,0,.18); display: none; flex-direction: column; overflow: hidden;
    right: 20px; bottom: 84px;
  }
  .cw-wrap.open { display: flex; }
  .cw-head {
    height: 46px; display: flex; align-items: center; justify-content: space-between;
    padding: 0 12px; border-bottom: 1px solid #e5e7eb; background: #f9fafb; font: 600 14px/1.2 system-ui, sans-serif;
  }
  .cw-close { appearance: none; background: transparent; border: none; cursor: pointer; font-size: 18px; color: #6b7280; }
  .cw-body { flex: 1; overflow: auto; padding: 12px; background: #fff; }
  .cw-row { display: flex; margin: 8px 0; }
  .cw-row.user { justify-content: flex-end; }
  .cw-row.assistant { justify-content: flex-start; }
  .cw-bubble {
    max-width: 80%; padding: 8px 10px; border-radius: 10px;
    font: 14px/1.45 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }
  .cw-bubble.user { background: #0b66ff; color: #fff; border: none; white-space: pre-wrap; }
  .cw-bubble.assistant { background: #f8fafc; color: #0f172a; border: 1px solid #e5e7eb; white-space: normal; }
  .cw-bubble.assistant h1,.cw-bubble.assistant h2,.cw-bubble.assistant h3,.cw-bubble.assistant h4 { margin: 0.4em 0 0.3em; }
  .cw-bubble.assistant p { margin: 0.4em 0; }
  .cw-bubble.assistant ul, .cw-bubble.assistant ol { margin: 0.4em 0 0.4em 1.2em; }
  .cw-bubble.assistant li { margin: 0.2em 0; }
  .cw-bubble.assistant a { color: #0b66ff; text-decoration: underline; }
  .cw-bubble.assistant code { background: #f1f5f9; padding: 0 4px; border-radius: 4px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12.5px; }
  .cw-bubble.assistant pre { background: #0f172a; color: #e2e8f0; padding: 10px; border-radius: 8px; overflow: auto; }
  .cw-bubble.assistant pre code { background: transparent; color: inherit; padding: 0; }
  .cw-bubble.assistant blockquote { border-left: 3px solid #e5e7eb; margin: 0.4em 0; padding: 0.1em 0 0.1em 10px; color: #334155; }
  .cw-foot { border-top: 1px solid #e5e7eb; padding: 10px; display: flex; gap: 8px; background: #f9fafb; }
  .cw-input { flex: 1; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; }
  .cw-send { padding: 10px 12px; border-radius: 8px; background: #0b66ff; color: #fff; border: none; cursor: pointer; font-size: 14px; }
  .cw-send[disabled] { background: #93c5fd; cursor: default; }
  .cw-hint { color: #6b7280; font: 12px/1.2 system-ui, sans-serif; margin: 6px 10px 10px; }
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
  btn.innerHTML = "💬";

  var wrap = document.createElement("div");
  wrap.className = "cw-wrap";

  var head = document.createElement("div");
  head.className = "cw-head";
  var titleEl = document.createElement("div");
  titleEl.textContent = "Chat";
  var close = document.createElement("button");
  close.className = "cw-close";
  close.setAttribute("aria-label", "Close");
  close.innerHTML = "✕";
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

  foot.appendChild(input);
  foot.appendChild(send);

  wrap.appendChild(head);
  wrap.appendChild(body);
  wrap.appendChild(foot);
  wrap.appendChild(hint);

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