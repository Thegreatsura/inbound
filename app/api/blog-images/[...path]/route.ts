import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const BLOG_IMAGE_DIRECTORY = path.join(process.cwd(), "content/blog/images");

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
	".apng": "image/apng",
	".avif": "image/avif",
	".bmp": "image/bmp",
	".gif": "image/gif",
	".heic": "image/heic",
	".heif": "image/heif",
	".ico": "image/x-icon",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".png": "image/png",
	".svg": "image/svg+xml",
	".tif": "image/tiff",
	".tiff": "image/tiff",
	".webp": "image/webp",
};

export const runtime = "nodejs";

function hasUnsafePathSegment(pathSegments: string[]): boolean {
	return pathSegments.some(
		(segment) =>
			segment.trim().length === 0 ||
			segment.includes("..") ||
			segment.includes("/") ||
			segment.includes("\\"),
	);
}

function getContentType(filePath: string): string {
	const extension = path.extname(filePath).toLowerCase();
	return CONTENT_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path: pathSegments } = await params;

	if (!Array.isArray(pathSegments) || pathSegments.length === 0) {
		return NextResponse.json({ error: "Missing image path" }, { status: 400 });
	}

	if (hasUnsafePathSegment(pathSegments)) {
		return NextResponse.json({ error: "Invalid image path" }, { status: 400 });
	}

	const requestedPath = path.resolve(BLOG_IMAGE_DIRECTORY, ...pathSegments);
	const expectedPrefix = `${BLOG_IMAGE_DIRECTORY}${path.sep}`;

	if (!requestedPath.startsWith(expectedPrefix)) {
		return NextResponse.json({ error: "Invalid image path" }, { status: 400 });
	}

	try {
		const fileBuffer = await readFile(requestedPath);

		return new NextResponse(fileBuffer, {
			status: 200,
			headers: {
				"Cache-Control": "public, max-age=31536000, immutable",
				"Content-Type": getContentType(requestedPath),
			},
		});
	} catch {
		return NextResponse.json({ error: "Image not found" }, { status: 404 });
	}
}
