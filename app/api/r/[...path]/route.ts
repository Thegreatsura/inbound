import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params
    const fileName = path.join("/")

    // Security: Only allow .json files
    if (!fileName.endsWith(".json")) {
      return NextResponse.json(
        { error: "Only JSON files are allowed" },
        { status: 400 }
      )
    }

    // Read the file from public/r directory
    const filePath = join(process.cwd(), "public", "r", fileName)
    const content = await readFile(filePath, "utf-8")

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (error) {
    console.error("Error serving registry file:", error)
    return NextResponse.json(
      { error: "Registry item not found" },
      { status: 404 }
    )
  }
}
