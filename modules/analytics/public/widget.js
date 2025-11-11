(function () {
  try {
    const PATH = location.pathname;
    const isAdminPath = PATH.startsWith("/admin");
    const cookies = document.cookie || "";
    const isAdminCookie = /role=admin/i.test(cookies) || /admin_session=1/.test(cookies);
    if (isAdminPath || isAdminCookie) return; // do not load tracker for admin

    const ORIGIN = location.origin;
    const ENDPOINT = ORIGIN + "/api/modules/analytics/collect";

    const CID_KEY = "an_client_id";
    function uuid() {
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
      );
    }
    let cid = localStorage.getItem(CID_KEY);
    if (!cid) {
      cid = uuid();
      try { localStorage.setItem(CID_KEY, cid); } catch {}
    }

    function detectEntity(path) {
      const parts = path.replace(/^\/+/, "").split("/");
      if (parts[0] === "blog" || parts[0] === "posts") return { entityType: "blog", entityId: parts[1] || null };
      if (parts[0] === "projects" || parts[0] === "project") return { entityType: "project", entityId: parts[1] || null };
      return { entityType: "page", entityId: null };
    }

    let lastPath = null;
    let lastSentAt = 0;
    function sendPing() {
      const path = location.pathname + location.search;
      if (path.startsWith("/admin")) return; // runtime guard
      if (path === lastPath && Date.now() - lastSentAt < 1500) return;
      lastPath = path;
      lastSentAt = Date.now();
      const { entityType, entityId } = detectEntity(location.pathname);
      const payload = {
        path,
        title: document.title || null,
        referrer: document.referrer || null,
        entityType,
        entityId,
        clientId: cid
      };
      navigator.sendBeacon
        ? navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify(payload)], { type: "application/json" }))
        : fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), keepalive: true });
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
      sendPing();
    } else {
      addEventListener("DOMContentLoaded", sendPing);
    }

    const push = history.pushState;
    const replace = history.replaceState;
    history.pushState = function () { push.apply(this, arguments); setTimeout(sendPing, 10); };
    history.replaceState = function () { replace.apply(this, arguments); setTimeout(sendPing, 10); };
    addEventListener("popstate", () => setTimeout(sendPing, 10));
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(sendPing, 10); });
  } catch {}
})();