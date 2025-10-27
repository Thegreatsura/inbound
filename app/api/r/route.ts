import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

export async function GET() {
  try {
    // Read the registry.json file
    const registryPath = join(process.cwd(), "registry.json")
    const content = await readFile(registryPath, "utf-8")
    const registry = JSON.parse(content)

    return NextResponse.json(registry, {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (error) {
    console.error("Error reading registry:", error)
    return NextResponse.json(
      { error: "Failed to load registry" },
      { status: 500 }
    )
  }
}
