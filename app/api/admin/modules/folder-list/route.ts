import { NextResponse } from "next/server";

export async function GET() {
  try {
    // require server-only modules here to avoid client bundle issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("path");

    const modulesDir = path.join(process.cwd(), "modules");
    if (!fs.existsSync(modulesDir)) return NextResponse.json([]);

    const ids = fs.readdirSync(modulesDir).filter((d: string) =>
      fs.statSync(path.join(modulesDir, d)).isDirectory()
    );

    const out = ids.map((id: string) => {
      const mpath = path.join(modulesDir, id, "manifest.json");
      let manifest = null;
      if (fs.existsSync(mpath)) {
        try {
          manifest = JSON.parse(fs.readFileSync(mpath, "utf8"));
        } catch {}
      }
      return { id, manifestPresent: !!manifest, manifest };
    });

    return NextResponse.json(out);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}