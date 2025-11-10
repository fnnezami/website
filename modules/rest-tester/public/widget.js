(function () {
  "use strict";

  // Only show for admins
  fetch("/api/modules/rest-tester/check-auth")
    .then((r) => r.json())
    .then((data) => {
      if (data && data.isAdmin) initWidget();
    })
    .catch(() => {});

  function initWidget() {
    // Styles
    const style = document.createElement("style");
    style.textContent = `
      #rest-tester-fab {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 56px;
        height: 56px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: move;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9997;
        transition: transform 0.2s;
        user-select: none;
      }
      #rest-tester-fab:hover { transform: scale(1.05); }
      #rest-tester-fab svg { width: 28px; height: 28px; fill: white; }
      #rest-tester-panel {
        position: fixed;
        top: 100px;
        right: 20px;
        width: 520px;
        height: 640px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        display: none;
        flex-direction: column;
        z-index: 9998;
        overflow: hidden;
      }
      #rest-tester-panel.active { display: flex; }
      .rest-header {
        padding: 12px 14px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: move;
        user-select: none;
      }
      .rest-body { flex: 1; overflow-y: auto; padding: 14px; }
      .rest-footer { padding: 12px 14px; border-top: 1px solid #e5e7eb; display: flex; gap: 8px; }
      .rest-select, .rest-input {
        width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; margin-bottom: 10px;
      }
      .rest-textarea {
        width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; min-height: 90px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; margin-bottom: 10px;
      }
      .rest-label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: #374151; }
      .rest-btn { padding: 8px 14px; border-radius: 6px; font-weight: 700; cursor: pointer; border: none; font-size: 14px; }
      .rest-btn-primary { background: #1f2937; color: white; }
      .rest-btn-primary:hover { background: #111827; }
      .rest-btn-secondary { background: #f3f4f6; color: #374151; }
      .rest-response {
        background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-top: 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px;
        max-height: 220px; overflow-y: auto;
      }
      .rest-status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-bottom: 8px; }
      .rest-status-success { background: #dcfce7; color: #166534; }
      .rest-status-error { background: #fee2e2; color: #991b1b; }
      .rest-resize-handle { position: absolute; right: 0; bottom: 0; width: 20px; height: 20px; cursor: nwse-resize;
        background: linear-gradient(135deg, transparent 50%, #d1d5db 50%); }
      .rest-checkbox { margin-right: 6px; }
    `;
    document.head.appendChild(style);

    // FAB Button (draggable)
    const fab = document.createElement("div");
    fab.id = "rest-tester-fab";
    fab.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2zm-1 9h2v5h-2v-5zM6 13h2v3H6v-3z"/></svg>
    `;
    document.body.appendChild(fab);

    // Panel (draggable + resizable)
    const panel = document.createElement("div");
    panel.id = "rest-tester-panel";
    panel.innerHTML = `
      <div class="rest-header">
        <span>REST API Tester</span>
        <button class="rest-btn rest-btn-secondary" id="rest-close" style="padding:4px 8px;font-size:12px;">✕</button>
      </div>
      <div class="rest-body">
        <input type="text" class="rest-input" id="rest-search" placeholder="Search requests..." />
        <label class="rest-label">Select Request</label>
        <select class="rest-select" id="rest-request-select">
          <option value="">-- Choose a request --</option>
        </select>
        <div id="rest-form-container"></div>
        <div id="rest-response-container"></div>
      </div>
      <div class="rest-footer">
        <button class="rest-btn rest-btn-primary" id="rest-send">Send Request</button>
      </div>
      <div class="rest-resize-handle"></div>
    `;
    document.body.appendChild(panel);

    // State
    let requests = [];
    let selectedRequest = null;
    let formValues = {};

    async function loadRequests() {
      try {
        const res = await fetch("/api/modules/rest-tester/requests");
        const data = await res.json();
        requests = (data && data.requests) || [];
        renderRequestSelect();
      } catch {}
    }

    function renderRequestSelect() {
      const select = document.getElementById("rest-request-select");
      const search = (document.getElementById("rest-search").value || "").toLowerCase();
      const filtered = requests.filter(
        (r) =>
          r.name.toLowerCase().includes(search) ||
          (r.description && r.description.toLowerCase().includes(search))
      );
      select.innerHTML = '<option value="">-- Choose a request --</option>';
      filtered
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((req) => {
          const opt = document.createElement("option");
          opt.value = req.id;
          opt.textContent = `${req.method} - ${req.name}`;
          select.appendChild(opt);
        });
    }

    function renderForm(request) {
      selectedRequest = request;
      formValues = { ...(request?.params || {}) };

      const container = document.getElementById("rest-form-container");
      container.innerHTML = "";
      if (!request) return;

      // Auth override
      if (request.auth_type && request.auth_type !== "none") {
        const authTitle = document.createElement("label");
        authTitle.className = "rest-label";
        authTitle.textContent = "Override Auth";
        container.appendChild(authTitle);

        const authCheck = document.createElement("input");
        authCheck.type = "checkbox";
        authCheck.className = "rest-checkbox";
        authCheck.id = "rest-auth-override";
        container.appendChild(authCheck);
        container.appendChild(document.createTextNode(" Use custom auth for this request"));
        container.appendChild(document.createElement("br"));
        container.appendChild(document.createElement("br"));

        Object.keys(request.auth_config || {}).forEach((key) => {
          const label = document.createElement("label");
          label.className = "rest-label";
          label.textContent = key;
          container.appendChild(label);

          const input = document.createElement("input");
          input.type = "text";
          input.className = "rest-input";
          input.id = `rest-auth-${key}`;
          input.value = request.auth_config[key] || "";
          input.disabled = true;
          container.appendChild(input);

          authCheck.addEventListener("change", (e) => {
            input.disabled = !e.target.checked;
          });
        });
      }

      // Params
      Object.keys(request.params || {}).forEach((key) => {
        const fieldType = (request.field_types && request.field_types[key]) || "text";
        const label = document.createElement("label");
        label.className = "rest-label";
        label.textContent = key;
        container.appendChild(label);

        let input;
        if (fieldType === "boolean") {
          input = document.createElement("input");
          input.type = "checkbox";
          input.className = "rest-checkbox";
          input.checked = !!formValues[key];
          input.addEventListener("change", (e) => (formValues[key] = e.target.checked));
        } else if (fieldType === "textarea" || fieldType === "json") {
          input = document.createElement("textarea");
          input.className = "rest-textarea";
          input.value = formValues[key] || "";
          input.addEventListener("input", (e) => (formValues[key] = e.target.value));
        } else if (fieldType === "number") {
          input = document.createElement("input");
          input.type = "number";
          input.className = "rest-input";
          input.value = formValues[key] || "";
          input.addEventListener("input", (e) => (formValues[key] = e.target.value));
        } else {
          input = document.createElement("input");
          input.type = "text";
          input.className = "rest-input";
          input.value = formValues[key] || "";
          input.addEventListener("input", (e) => (formValues[key] = e.target.value));
        }
        container.appendChild(input);
      });
    }

    async function sendRequest() {
      if (!selectedRequest) return;

      const responseContainer = document.getElementById("rest-response-container");
      responseContainer.innerHTML = '<div class="rest-response">Sending...</div>';

      try {
        const startTime = Date.now();

        // Headers
        const headers = { ...(selectedRequest.headers || {}) };

        // Auth base
        if (selectedRequest.auth_type === "bearer") {
          const token = (selectedRequest.auth_config && selectedRequest.auth_config.token) || "";
          if (token) headers["Authorization"] = `Bearer ${token}`;
        } else if (selectedRequest.auth_type === "basic") {
          const username = (selectedRequest.auth_config && selectedRequest.auth_config.username) || "";
          const password = (selectedRequest.auth_config && selectedRequest.auth_config.password) || "";
          if (username || password) headers["Authorization"] = `Basic ${btoa(`${username}:${password}`)}`;
        } else if (selectedRequest.auth_type === "apikey") {
          const keyName = (selectedRequest.auth_config && selectedRequest.auth_config.keyName) || "X-API-Key";
          const keyValue = (selectedRequest.auth_config && selectedRequest.auth_config.keyValue) || "";
          if (keyValue) headers[keyName] = keyValue;
        }

        // Auth override
        const authOverride = document.getElementById("rest-auth-override");
        if (authOverride && authOverride.checked) {
          Object.keys(selectedRequest.auth_config || {}).forEach((key) => {
            const el = document.getElementById(`rest-auth-${key}`);
            if (!el) return;
            const val = el.value || "";
            if (selectedRequest.auth_type === "bearer" && key.toLowerCase().includes("token")) {
              headers["Authorization"] = `Bearer ${val}`;
            } else if (selectedRequest.auth_type === "apikey") {
              headers[key] = val;
            } else if (selectedRequest.auth_type === "basic") {
              // Expect username/password fields
              const u = (document.getElementById("rest-auth-username") || {}).value || "";
              const p = (document.getElementById("rest-auth-password") || {}).value || "";
              headers["Authorization"] = `Basic ${btoa(`${u}:${p}`)}`;
            }
          });
        }

        // Build request
        let url = selectedRequest.url;
        let body = null;

        if (selectedRequest.method === "GET" || selectedRequest.method === "HEAD") {
          const params = new URLSearchParams();
          Object.entries(formValues).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
          });
          if (params.toString()) url += (url.includes("?") ? "&" : "?") + params.toString();
        } else {
          headers["Content-Type"] = "application/json";
          body = JSON.stringify(formValues);
        }

        const res = await fetch(url, { method: selectedRequest.method, headers, body });
        const elapsed = Date.now() - startTime;

        let text = await res.text();
        try {
          const json = JSON.parse(text);
          text = JSON.stringify(json, null, 2);
        } catch {}

        const statusClass = res.ok ? "rest-status-success" : "rest-status-error";
        responseContainer.innerHTML = `
          <div class="rest-response">
            <div class="rest-status ${statusClass}">${res.status} ${res.statusText}</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:8px;">${elapsed}ms</div>
            <pre style="margin:0;white-space:pre-wrap;word-break:break-word;">${text || "(empty response)"}</pre>
          </div>
        `;

        if (navigator.vibrate) navigator.vibrate(res.ok ? 50 : [100, 50, 100]);
      } catch (err) {
        responseContainer.innerHTML = `
          <div class="rest-response">
            <div class="rest-status rest-status-error">Error</div>
            <pre style="margin:0;white-space:pre-wrap;word-break:break-word;">${(err && err.message) || String(err)}</pre>
          </div>
        `;
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }
    }

    // Events
    fab.addEventListener("click", () => {
      panel.classList.toggle("active");
      if (panel.classList.contains("active")) loadRequests();
    });
    document.getElementById("rest-close").addEventListener("click", () => panel.classList.remove("active"));
    document.getElementById("rest-request-select").addEventListener("change", (e) => {
      const req = requests.find((r) => r.id === e.target.value);
      renderForm(req || null);
      document.getElementById("rest-response-container").innerHTML = "";
    });
    document.getElementById("rest-search").addEventListener("input", renderRequestSelect);
    document.getElementById("rest-send").addEventListener("click", sendRequest);

    // Drag helpers
    makeDraggable(fab);
    makeDraggable(panel, panel.querySelector(".rest-header"));
    makeResizable(panel, panel.querySelector(".rest-resize-handle"));

    function makeDraggable(el, handle = el) {
      let dragging = false, dx = 0, dy = 0;
      handle.addEventListener("mousedown", (e) => {
        if (e.target.closest("button") || e.target.closest("select") || e.target.closest("input")) return;
        dragging = true;
        dx = e.clientX - el.offsetLeft;
        dy = e.clientY - el.offsetTop;
        e.preventDefault();
      });
      document.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        el.style.left = e.clientX - dx + "px";
        el.style.top = e.clientY - dy + "px";
        el.style.right = "auto";
        el.style.bottom = "auto";
      });
      document.addEventListener("mouseup", () => (dragging = false));
    }

    function makeResizable(el, handle) {
      let resizing = false, sx = 0, sy = 0, sw = 0, sh = 0;
      handle.addEventListener("mousedown", (e) => {
        resizing = true;
        sx = e.clientX; sy = e.clientY;
        sw = el.offsetWidth; sh = el.offsetHeight;
        e.preventDefault(); e.stopPropagation();
      });
      document.addEventListener("mousemove", (e) => {
        if (!resizing) return;
        const nw = Math.max(360, sw + (e.clientX - sx));
        const nh = Math.max(420, sh + (e.clientY - sy));
        el.style.width = nw + "px";
        el.style.height = nh + "px";
      });
      document.addEventListener("mouseup", () => (resizing = false));
    }
  }
})();