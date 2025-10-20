import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  try {
    const { file } = await params;
    
    // Only allow README.md and LLM-GUIDE.md
    if (file !== "README.md" && file !== "LLM-GUIDE.md") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const filePath = path.join(process.cwd(), "app", "admin", "modules", "guide", file);
    const content = await fs.readFile(filePath, "utf-8");

    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("Error loading guide:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load guide" },
      { status: 500 }
    );
  }
}