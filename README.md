

<!-- Badges -->
<p align="center">
  <a href="https://farbodnezami.me" target="_blank">
    <img alt="Live Site" src="https://img.shields.io/badge/site-farbodnezami.me-111827?logo=google-chrome&logoColor=white">
  </a>
  <a href="https://github.com/fnnezami/website/actions/workflows/deploy.yml">
    <img alt="Build Status" src="https://github.com/fnnezami/website/actions/workflows/deploy.yml/badge.svg">
  </a>
  <a href="https://nodejs.org/" target="_blank">
    <img alt="Node Version (dynamic)" src="https://img.shields.io/github/package-json/engines/fnnezami/website?label=Node&logo=node.js&logoColor=white">
  </a>
  <a href="https://nextjs.org/" target="_blank">
    <img alt="Next.js Version (dynamic)" src="https://img.shields.io/github/package-json/dependency-version/fnnezami/website/next?label=Next.js&logo=next.js">
  </a>
</p>

# Personal Website

A modular, theme-aware personal website powered by Next.js, TypeScript, Tailwind CSS, and Supabase. Content is sourced from a JSON Resume Gist and a JSON knowledge base used by the built-in chat. The site includes a pluggable modules system (API, admin, pages, floating widgets), OAuth authentication via Supabase (currently GitHub), a REST API Tester module, and a Server Monitor module.

## Highlights

- Next.js (App Router), TypeScript, Tailwind CSS
- Live theme editing with global CSS variables and dark mode support
- Supabase for auth (OAuth) and persistence
- Content from JSON Resume Gist (profile, links, about)
- Chat backed by a JSON knowledge base
- Modular architecture (API routes, Admin UI, Pages, Floating widgets)
- Built-in modules:
  - REST API Tester (admin UI + floating widget)
  - Server Monitor (admin UI + status panel)

---

## Features

### 1) Content & Data
- JSON Resume Gist feeds profile header, links, and summary.
- JSON Knowledge Base (KB) powers the on-site chat.
- Supabase Postgres stores module data (e.g., saved REST requests).

### 2) Theming
- Live theme editor controlling CSS variables across the site.
- Dark mode support (prefers-color-scheme and .dark class).
- Floating widgets inherit and update with the global theme automatically.

### 3) Authentication
- Supabase OAuth (currently GitHub) for admin access.
- Admin area under /admin; modules expose their admin UIs here.
- Server-side routes use Supabase service role keys where needed.

### 4) Modular Architecture
Each module can add one or more of:
- API route(s) (mounted under /api/modules/<module-id>)
- Admin page (rendered under /admin/modules/<module-id>)
- Regular page(s)
- Floating widget (client-injected UI honoring global theme)

A typical module includes:
- manifest.json (module metadata)
- admin.tsx (admin UI)
- server/route.ts (API route handler)
- public/widget.js (optional floating widget, admin-only by default)
- migrations/*.sql (schema changes)
- install.js / uninstall.js (migration helpers)

Use modules/rest-tester as a reference template.

### 5) REST API Tester Module
- Per-request enable/disable (without deleting)
- Sidebar with search, edit, delete, and enable toggle
- Non-native draggable/resizable modals for params, headers, and auth
- Field type inference for parameters (text, number, boolean, json, textarea)
- Auth presets: None, Bearer, Basic, API Key, Custom headers
- Floating widget for admins:
  - Lists only enabled requests
  - Adapts to global theme and updates on theme changes
  - Draggable/resizable panel, searchable requests, inline response viewer

### 6) Server Monitor Module
- Admin-configurable checks (e.g., HTTP ping/endpoints)
- Status overview panel
- Theme-aware UI
- Extensible to add custom checks or notifications

### 7) Chat With JSON Knowledge Base
- Uses a local or remote JSON KB to answer questions
- Theme-aware UI
- Modular: replace or augment KB loader as needed

---

## Project Structure (excerpt)

```
components/
  ProfileHeader.tsx
modules/
  rest-tester/
    admin.tsx
    server/route.ts
    public/widget.js
    install.js
    uninstall.js
    migrations/
      0001_create_rest_requests.sql
      (additional migrations)
  server-monitor/
    ... (similar structure)
app/
  admin/
    modules/[id]/page.tsx
  api/
    modules/
      rest-tester/route (handled by modules/rest-tester/server/route.ts)
public/
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm or npm
- Supabase project (URL + keys)
- A GitHub OAuth app configured in Supabase (for OAuth sign-in)
- A JSON Resume Gist URL/ID
- Optional: JSON Knowledge Base URL or local file

### 1) Install

```bash
pnpm install
# or
npm install
```

### 2) Configure Environment

Create .env.local in the project root:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<server_role_key>  # server-side only, do not expose

# Content sources
RESUME_GIST_URL=<https://gist.githubusercontent.com/.../raw/.../resume.json>
# or RESUME_GIST_ID=<your_gist_id> (if your code uses ID-based fetching)

KNOWLEDGE_BASE_URL=<https://your-host/knowledge.json>  # or leave blank if local

# Optional misc
SITE_NAME="My Personal Site"
```

Configure GitHub OAuth inside Supabase (Authentication > Providers > GitHub). Ensure callback URLs match your deployment.

### 3) Database Migrations

Run module migrations (example: REST Tester):

- Option A (helper script):
  ```bash
  node modules/rest-tester/install.js
  ```
- Option B (manual):
  - Open the Supabase SQL editor and run the SQL files under modules/rest-tester/migrations.

When updating modules, repeat install scripts or apply new SQL migrations.

### 4) Develop

```bash
pnpm dev
# or
npm run dev
```

Visit:
- Site: http://localhost:3000
- Admin: http://localhost:3000/admin (sign in with GitHub)

---

## Usage

### Profile & Links
- ProfileHeader reads links and normalizes domains without schemes.
- Provide LinkedIn, GitHub, etc., as plain domains or full URLs; it converts to https:// automatically.

### Admin Area
- Navigate to /admin and sign in via GitHub (Supabase OAuth).
- Open a module from the sidebar, e.g., REST Tester or Server Monitor.

### REST API Tester
- Create requests, set params/headers/auth, and save.
- Toggle enable/disable to control visibility in the widget.
- Use draggable modals to add parameters/headers/auth settings.
- The floating widget (admin-only) appears on the site; click the FAB to open.

### Server Monitor
- Add endpoints/services to watch.
- Review status panel; refine checks as needed.

### Theme Editor
- Adjust the global theme via the live editor (CSS variables update instantly).
- Floating widgets and admin UIs inherit and update with the theme automatically.

### Chat
- The chat feature consumes the JSON KB.
- Replace or extend the KB source as needed.

---

## Create Your Own Module

1. Create modules/<your-module> with:
   - manifest.json
   - admin.tsx
   - server/route.ts
   - public/widget.js (optional)
   - migrations/*.sql
   - install.js / uninstall.js

2. Implement server/route.ts to handle:
   - GET/POST/PUT/DELETE under /api/modules/<your-module>/...

3. Build an admin UI in admin.tsx:
   - Use client components as needed.
   - Follow pattern in modules/rest-tester/admin.tsx.

4. If you need a floating widget:
   - Put a self-contained script in public/widget.js.
   - Avoid native popups; use custom, draggable/resizable UI.

5. Ship per-module README:
   - Document endpoints, config, and admin usage.

Tip: Start by copying modules/rest-tester and trimming what you don’t need.

---

## Deployment

- Build:
  ```bash
  pnpm build
  ```
- Start:
  ```bash
  pnpm start
  ```
- Set env vars on your hosting platform (Supabase keys, Gist URLs, etc.).
- Ensure Supabase OAuth redirect/callback URLs match your deployment domain.

---

## Troubleshooting

- Links resolving under /admin: ensure external links are absolute or normalized (the project includes an ensureAbsolute helper).
- Theme not updating in widgets: confirm global CSS variables update and that the document root toggles the .dark class when applicable.
- Supabase errors: verify NEXT_PUBLIC_SUPABASE_URL/ANON_KEY and server-side SUPABASE_SERVICE_ROLE_KEY.

---

## Contributing

- Fork and create a feature branch.
- Follow a clear commit style.
- Add/update module-specific READMEs for APIs and widgets.
- Open a PR.

Run lint before PR:
```bash
pnpm lint
```

---

## License

MIT © Contributors

## Badges Notes
Replace <OWNER>/<REPO> and build.yml with your actual GitHub owner, repo, and workflow filename. If you use pnpm or a different Node version, adjust the Node badge accordingly. For dynamic Node badge you can use:
https://img.shields.io/github/package-json/engines/<OWNER>/<REPO>?label=Node
