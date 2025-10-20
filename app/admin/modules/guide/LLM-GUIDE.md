# Module Development Guide for AI Assistants

You are helping to create a module for a Next.js 15 website with a dynamic module system. Here's everything you need to know:

## System Architecture

### Module Discovery & Loading
- Modules live in `modules/<moduleId>/` folder
- Each module requires `manifest.json` at root
- System scans for modules at runtime (no rebuild needed)
- Modules can be installed via ZIP upload or from local folder

### Module Types
1. **Page Modules**: Provide public pages under `/m/<slug>`
2. **Floating Widgets**: Inject UI via `public/widget.js`
3. **Admin-only Modules**: Only provide admin interface
4. **API Modules**: Server-side logic only

## File Structure

```
modules/
  <moduleId>/
    manifest.json       # Required: module metadata
    public/            # Optional: public pages and assets
      page.tsx         # Landing page component
      [slug]/          # Dynamic routes
        page.tsx
      widget.js        # Floating widget script
    admin.tsx          # Optional: admin UI component
    server/            # Optional: server-side code
      route.ts         # API handlers
    migrations/        # Optional: database migrations
    install.js         # Optional: install hook
    uninstall.js       # Optional: cleanup hook
```

## manifest.json Structure

```json
{
  "id": "my-module",           // Required: unique identifier
  "slug": "my-module",          // Recommended: URL-friendly name
  "title": "My Module",         // Display name
  "description": "...",         // Short description
  "version": "1.0.0",          // Semantic version
  "config": {
    "pagePath": "/modules/my-module/public"  // For page modules
  }
}
```

## Available APIs & Routes

### Module Registry API
- `GET /api/modules/registry` - List all modules
- `GET /api/modules/registry?includeDisabled=1` - Include disabled modules

### Module Admin APIs
- `POST /api/admin/modules/set-enabled` - Enable/disable module
  Body: `{ id: string, enabled: boolean }`
- `POST /api/admin/modules/install` - Install module from folder
  Body: `{ moduleId: string }`
- `POST /api/admin/modules/install-zip` - Upload ZIP file
  Body: FormData with 'file' field
- `POST /api/admin/modules/uninstall` - Remove module
  Body: `{ moduleId: string }`
- `GET /api/admin/modules/folder-list` - List available modules in folder
- `GET /api/admin/modules/logs?moduleId=<id>` - View module logs
- `GET /api/admin/modules/file-tree?moduleId=<id>` - Get module file structure

### Module Content APIs
- `GET /modules/<id>/manifest.json` - Public manifest
- `GET /modules/<id>/public/<path>` - Static assets
- `/api/modules/<id>/<...rest>` - Proxied to module's `server/` handlers

### Code Editor APIs (for admin)
- `POST /api/admin/code/read` - Read file
  Body: `{ file: string }`
- `POST /api/admin/code/save` - Save file
  Body: `{ file: string, code: string }`

## Database Access

Modules can access Supabase via environment variables:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

### Available Tables
- `modules` - Module registry (id, slug, title, enabled, config, etc.)
- `module_logs` - Installation/migration logs
- Custom tables can be created via migrations

## Page Module Example

```tsx
// modules/blog/public/page.tsx
import React from 'react';

export default function BlogPage() {
  return (
    <div className="container mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold">Blog</h1>
      <p>Welcome to the blog module</p>
    </div>
  );
}
```

## Floating Widget Example

```javascript
// modules/chat/public/widget.js
(function() {
  const widget = document.createElement('div');
  widget.id = 'chat-widget';
  widget.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 60px;
    height: 60px;
    background: #000;
    color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 9999;
  `;
  widget.textContent = '💬';
  document.body.appendChild(widget);
})();
```

## Admin Component Example

```tsx
// modules/settings/admin.tsx
import React, { useState } from 'react';

export default function AdminPanel() {
  const [setting, setSetting] = useState('');
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Module Settings</h2>
      <input 
        value={setting}
        onChange={(e) => setSetting(e.target.value)}
        className="border rounded px-3 py-2"
      />
      <button className="bg-black text-white px-4 py-2 rounded">
        Save
      </button>
    </div>
  );
}
```

## Server API Example

```typescript
// modules/api-module/server/route.ts
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  return NextResponse.json({ 
    ok: true, 
    data: 'Module API response' 
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  // Handle request
  return NextResponse.json({ ok: true });
}
```

## Install Hook Example

```javascript
// modules/my-module/install.js
module.exports = async function install({ supabase }) {
  // Run installation logic
  console.log('Installing module...');
  
  // Create tables if needed
  await supabase.from('my_module_data').insert([
    { key: 'initialized', value: 'true' }
  ]);
  
  return { success: true };
};
```

## Best Practices

1. **Always provide manifest.json** with at minimum: id, slug, title
2. **Use TypeScript** for type safety (.tsx, .ts files)
3. **Follow Next.js conventions** for page components
4. **Keep secrets in server/** folder, never in public/
5. **Use descriptive IDs** - they become folder names and URLs
6. **Test install/uninstall** hooks thoroughly
7. **Handle errors gracefully** in all API routes
8. **Use Tailwind CSS** for styling consistency
9. **Make admin UIs responsive** with mobile-first approach
10. **Document your module** with inline comments

## Styling

The site uses Tailwind CSS. Common patterns:
- Containers: `container mx-auto px-6 py-8`
- Cards: `rounded-lg border bg-white p-4`
- Buttons: `px-4 py-2 rounded-md bg-black text-white`
- Inputs: `border rounded-md px-3 py-2`

## Testing Your Module

1. Create folder structure under `modules/<id>/`
2. Add manifest.json
3. Add your code files
4. ZIP the module folder
5. Upload via Admin > Modules > Install from ZIP
6. Check logs if installation fails
7. Enable the module via toggle
8. Visit `/m/<slug>` for page modules
9. Check admin panel for admin modules

## Common Pitfalls

- Missing manifest.json → Module won't be discovered
- Wrong file paths in manifest.config.pagePath → 404 errors
- Forgot to export default from page.tsx → Render error
- Server code in public/ → Security risk
- Hardcoded URLs instead of relative paths → Breaks on deploy

## When to Use Each Module Type

- **Page Module**: Blog, gallery, documentation, any content pages
- **Floating Widget**: Chat, notifications, feedback forms
- **Admin-only**: Settings panels, analytics dashboards
- **API Module**: Webhooks, integrations, background jobs

Remember: Modules are hot-loaded. No rebuild needed after installation!