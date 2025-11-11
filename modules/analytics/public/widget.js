(() => {
  const endpoint = "/api/modules/analytics/collect";
  const LS_KEY = "__an_cid";
  const ONE_MIN = 60 * 1000;

  function uuid() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
  }
  function getCid() {
    try {
      let cid = localStorage.getItem(LS_KEY);
      if (!cid) { cid = uuid(); localStorage.setItem(LS_KEY, cid); }
      return cid;
    } catch { return uuid(); }
  }
  function getInfo() {
    let ref = document.referrer || "";
    try { if (ref && new URL(ref).host === location.host) ref = ""; } catch {}
    return { path: location.pathname + location.search, title: document.title || "", referrer: ref };
  }

  let lastSig = ""; let lastAt = 0;
  async function send() {
    const now = Date.now();
    const { path, title, referrer } = getInfo();
    const sig = path + "|" + title;
    if (sig === lastSig && now - lastAt < ONE_MIN) return;
    lastSig = sig; lastAt = now;

    const payload = { path, title, referrer, clientId: getCid() };
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([JSON.stringify(payload)], { type: "application/json" }));
      } else {
        await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), keepalive: true });
      }
    } catch {}
  }

  if (document.readyState === "complete" || document.readyState === "interactive") send();
  else window.addEventListener("DOMContentLoaded", send, { once: true });

  (function hookSpa() {
    const ps = history.pushState, rs = history.replaceState;
    function onNav() { setTimeout(send, 0); }
    history.pushState = function(){ ps.apply(this, arguments); onNav(); };
    history.replaceState = function(){ rs.apply(this, arguments); onNav(); };
    window.addEventListener("popstate", onNav);
    window.addEventListener("hashchange", onNav);
  })();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") send();
  });
})();