(function () {
  const id = "chat";
  const mountId = "module-widget-" + id;
  function ensureStyles() {
    if (document.getElementById("module-widget-styles")) return;
    const css = `
      .chat-float-btn { position: fixed; right: 20px; bottom: 20px; z-index: 9999; }
      .chat-window { position: fixed; right: 20px; bottom: 80px; width: 320px; max-width: calc(100% - 40px); z-index: 9999; box-shadow: 0 10px 30px rgba(2,6,23,0.2); background:#fff; border-radius:10px; overflow:hidden; }
    `;
    const s = document.createElement("style");
    s.id = "module-widget-styles";
    s.appendChild(document.createTextNode(css));
    document.head.appendChild(s);
  }

  function render() {
    ensureStyles();
    const mount = document.getElementById(mountId);
    if (!mount) return;
    // avoid double-render
    if (mount.dataset._inited) return;
    mount.dataset._inited = "1";

    const btn = document.createElement("button");
    btn.className = "chat-float-btn";
    btn.textContent = "Chat";
    btn.onclick = () => {
      let w = document.getElementById("chat-window");
      if (w) { w.remove(); return; }
      w = document.createElement("div");
      w.id = "chat-window";
      w.className = "chat-window";
      w.innerHTML = `
        <div style="padding:12px;background:#0b66ff;color:#fff;display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:600">Chat</div>
          <button id="chat-close" style="background:transparent;border:none;color:#fff;cursor:pointer">Close</button>
        </div>
        <div style="padding:12px"><div id="chat-body">Welcome! (mock)</div><div style="margin-top:8px"><input id="chat-input" placeholder="Message..." style="width:100%;padding:8px;border-radius:6px;border:1px solid #e6e6e6"/></div></div>
      `;
      document.body.appendChild(w);
      document.getElementById("chat-close")?.addEventListener("click", () => w.remove());
    };
    mount.appendChild(btn);
  }

  // try to render immediately, or wait for DOM ready
  if (document.readyState === "complete" || document.readyState === "interactive") {
    render();
  } else {
    window.addEventListener("DOMContentLoaded", render);
  }
})();