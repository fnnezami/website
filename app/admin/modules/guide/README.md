# Runtime Modules — Authoring Guide

This project supports self‑contained modules that can be added, enabled, and used at runtime (no rebuild). A module is a folder under `modules/<moduleId>` with a required `manifest.json` and optional code/assets.

This guide explains:
- What files a module can provide
- What the manifest must include
- How page modules are resolved and rendered
- How floating modules (widgets) are discovered and loaded
- How to ship an admin‑only module (no public page)

The goal: anyone can create a module ZIP and drop it into the site via the Admin UI.

---

## How the system discovers and serves modules

- Discovery: the server scans `modules/*/manifest.json` at runtime.
- Public serving:
  - Manifest: `GET /modules/<id>/manifest.json`
  - Assets: `GET /modules/<id>/public/<...>` (only files under `public/` are served)
- Page routing: requests to `/m/<slug>` are matched to an installed module by slug rules (see “Page modules”).
- Floating widgets: the client looks for `public/widget.js` in each module and injects it if found.
- Admin UI: if a module exposes `admin.tsx`, the Admin area will render it for that module.

You do not need to hardcode module names or rebuild the app. Modules are picked up dynamically.

---

## Folder layout (module root)

At minimum, a module folder looks like this:

modules/
  <id>/
    manifest.json          // required
    public/                // optional: public pages/assets (served under /modules/<id>/public/...)
    admin.tsx              // optional: React component rendered by Admin UI
    server/                // optional: server code for module-local APIs
    migrations/            // optional: DB migrations (if your admin workflow uses them)
    install.js             // optional: install hook (run by admin workflow)
    uninstall.js           // optional: uninstall hook (run by admin workflow)

Example real modules in this repo:
- modules/blog-posts — page module with public pages, admin UI, server API, migrations
- modules/chat — floating widget (public/widget.js) and admin UI

---

## manifest.json (required)

The system requires a JSON manifest at the module root:
- Required: a stable module id (implicitly the folder name)
- Optional but supported:
  - slug: friendly identifier used in URLs and UI
  - config.pagePath: points to the folder that holds your public pages (commonly `/modules/<id>/public`)

Minimal example (page module):

```json
{
  "id": "blog-posts",
  "slug": "blog-posts",
  "title": "Blog",
  "description": "Blog pages and posts",
  "version": "0.1.0",
  "config": {
    "pagePath": "/modules/blog-posts/public"
  }
}
```

Minimal example (floating widget):

```json
{
  "id": "chat",
  "slug": "chat",
  "title": "Chat"
}
```

Notes
- If `slug` is omitted, the system falls back to the folder name (`id`).
- If `config.pagePath` is set, its basename contributes to page route matching (see below).

---

## Page modules (public pages)

A module becomes a “page module” by exposing React components under its `public/` folder and by being resolvable at `/m/<slug>`.

Where the pages live:
- Landing page: `modules/<id>/public/page.tsx` — default export React component
- Nested pages (optional): `modules/<id>/public/[slug]/page.tsx`, `public/a/b/page.tsx`, etc.

How routing resolves the module slug:
- When a user visits `/m/<slug>`, the server looks up an installed module using:
  1) `manifest.slug`, or
  2) the module folder name (`id`), or
  3) the basename of `manifest.config.pagePath` (e.g. `/modules/blog-posts/public` → `blog-posts`)
- If any of those equals `<slug>`, the module is selected and its page component is rendered.

Recommendations:
- Set `"slug"` in your manifest to the URL segment you want (e.g., `"blog-posts"`).
- Also set `"config.pagePath": "/modules/<id>/public"` so tooling can find your page files easily.

Navigation:
- The Navbar reads installed modules and creates entries for modules that resolve at `/m/<slug>`.
- Clicking the entry navigates to `/m/<slug>` and renders your `public/page.tsx`.

Example landing page component:

```tsx
// modules/<id>/public/page.tsx
import React from "react";

export default function ModuleLandingPage() {
  return <div>Your module landing page</div>;
}
```

Example nested page component:

```tsx
// modules/<id>/public/[slug]/page.tsx
import React from "react";

export default function ModuleDetailPage() {
  return <div>Detail page inside the module</div>;
}
```

Public asset fetching:
- Any file under `public/` is served at `/modules/<id>/public/<...>`.
- Use those URLs inside your components for images, scripts, and styles.

---

## Floating modules (widgets)

A module acts as a floating widget by providing a script at `public/widget.js`. The client attempts to load this file for each installed module and, if present, injects it into the page.

Conventions:
- Entry file: `modules/<id>/public/widget.js` (ES5/ES6 script)
- The script can:
  - Immediately mount a UI element into the DOM (IIFE style), or
  - Expose a global function that the host calls (depending on your loader usage)

Minimal example (IIFE that renders a floating box):

```js
// modules/<id>/public/widget.js
(function () {
  const el = document.createElement("div");
  el.id = "widget-<id>";
  el.style.position = "fixed";
  el.style.right = "16px";
  el.style.bottom = "16px";
  el.style.padding = "12px 16px";
  el.style.background = "#111";
  el.style.color = "#fff";
  el.style.borderRadius = "8px";
  el.textContent = "Hello from <id>!";
  document.body.appendChild(el);
})();
```

The script is fetched from:
- `/modules/<id>/public/widget.js`

If your module doesn’t need a floating widget, omit `public/widget.js`.

---

## Admin‑only modules (no public page)

A module can provide only an admin screen and nothing under `public/`. To do that:
- Include an `admin.tsx` at the module root exporting a React component.
- Keep your `manifest.json` minimal.

Example:

```tsx
// modules/<id>/admin.tsx
import React from "react";

export default function AdminPanel() {
  return (
    <div>
      <h1>Settings for <id></h1>
      <p>Configure your module here.</p>
    </div>
  );
}
```

The Admin area will render this component under the module’s entry. Since no public pages are provided, nothing will appear under `/m/<slug>` and the Navbar won’t link to it as a site page.

---

## Optional: server code and APIs

If your module needs server logic, place files under `modules/<id>/server/`. The app exposes a proxy under:

- `/api/modules/<id>/<...>` → module server handlers

Check `app/api/modules/[id]/[...rest]/route.ts` in the host app to see how it resolves into your `modules/<id>/server/*` code. Keep any secrets and server-only logic in this folder (do not put secrets in `public/`).

Example (one file approach):

```ts
// modules/<id>/server/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true });
}
```

Then call: `GET /api/modules/<id>/` (and nest routes using the rest parameter if needed).

---

## Packaging and installing a module

- Zip the module directory itself, so the ZIP root is the module folder (e.g., `blog-posts/` at the root of the ZIP).
- Ensure `manifest.json` is at the module root inside the ZIP.
- Include only the files you need:
  - `public/` (for pages/assets, including `widget.js` if you have a floating widget)
  - `admin.tsx` (for admin UI)
  - `server/` (for APIs)
  - `migrations/`, `install.js`, `uninstall.js` (if your admin workflow uses them)
- Upload via the Admin “Install Module” UI. The system extracts the ZIP to `modules/<id>/` and picks it up immediately.

Uninstalling and enabling/disabling are handled by the Admin UI and related APIs in `app/api/modules/*`.

---

## Summary checklist

Required
- [ ] `modules/<id>/manifest.json`

Page module
- [ ] `manifest.slug` set (recommended)
- [ ] `manifest.config.pagePath = "/modules/<id>/public"` (recommended)
- [ ] `modules/<id>/public/page.tsx` (landing page)
- [ ] Optional nested pages under `public/`

Floating module
- [ ] `modules/<id>/public/widget.js` (entry script)

Admin‑only module
- [ ] `modules/<id>/admin.tsx` (default export React component)
- [ ] No `public/` pages required

Server API (optional)
- [ ] `modules/<id>/server/*` (handlers proxied via `/api/modules/<id>/*`)

---

## Troubleshooting

- 404 on manifest:
  - Confirm `modules/<id>/manifest.json` exists and valid JSON
  - Open `/modules/<id>/manifest.json` in the browser

- 404 on public assets:
  - Files must be under `modules/<id>/public/...`
  - Open `/modules/<id>/public/...` to verify

- Navbar shows a module but clicking gives 404:
  - Ensure your manifest has the correct `slug` or `config.pagePath`
  - Ensure `public/page.tsx` exists and exports a component

- Floating widget doesn’t appear:
  - Ensure `public/widget.js` exists and loads (check Network tab for `/modules/<id>/public/widget.js`)
  - Verify the script actually mounts something to the DOM

If you need an example starter, copy `modules/blog-posts` (page module) or `modules/chat` (floating widget) and replace IDs and content.