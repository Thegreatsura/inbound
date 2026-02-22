#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const BLOG_DIRECTORY = path.join(process.cwd(), "content/blog");
const BLOG_IMAGE_DIRECTORY = path.join(BLOG_DIRECTORY, "images");
const BLOG_IMAGE_PUBLIC_BASE_PATH = "/blog/images";

const FRONTMATTER_IMAGE_FIELDS = ["image", "authorImage"] as const;

const MARKDOWN_IMAGE_REGEX =
	/(!\[[^\]]*\]\()(https?:\/\/[^)\s]+)((?:\s+"[^"]*")?\))/g;
const HTML_IMAGE_REGEX =
	/(<img\b[^>]*\bsrc=["'])(https?:\/\/[^"']+)(["'][^>]*>)/g;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
	"image/apng": ".apng",
	"image/avif": ".avif",
	"image/bmp": ".bmp",
	"image/gif": ".gif",
	"image/heic": ".heic",
	"image/heif": ".heif",
	"image/jpeg": ".jpg",
	"image/jpg": ".jpg",
	"image/png": ".png",
	"image/svg+xml": ".svg",
	"image/tiff": ".tiff",
	"image/webp": ".webp",
	"image/x-icon": ".ico",
};

const VALID_IMAGE_EXTENSIONS = new Set([
	".apng",
	".avif",
	".bmp",
	".gif",
	".heic",
	".heif",
	".ico",
	".jpeg",
	".jpg",
	".png",
	".svg",
	".tif",
	".tiff",
	".webp",
]);

type RewriteStats = {
	downloadedFiles: number;
	reusedFiles: number;
	rewrittenUrls: number;
	updatedPosts: number;
};

const stats: RewriteStats = {
	downloadedFiles: 0,
	reusedFiles: 0,
	rewrittenUrls: 0,
	updatedPosts: 0,
};

const imageUrlCache = new Map<string, string>();

function getDeterministicHash(input: string): string {
	return createHash("sha256").update(input).digest("hex").slice(0, 20);
}

function isHttpUrl(value: string): boolean {
	try {
		const parsed = new URL(value);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

function getExtensionFromUrl(urlValue: string): string | undefined {
	try {
		const parsed = new URL(urlValue);
		const extension = path.extname(parsed.pathname).toLowerCase();
		return VALID_IMAGE_EXTENSIONS.has(extension) ? extension : undefined;
	} catch {
		return undefined;
	}
}

function getExtensionFromContentType(contentType: string | null): string {
	if (!contentType) {
		return ".img";
	}

	const normalizedContentType = contentType.split(";")[0]?.trim().toLowerCase();

	if (!normalizedContentType) {
		return ".img";
	}

	return EXTENSION_BY_CONTENT_TYPE[normalizedContentType] ?? ".img";
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

async function ensureImageDownloaded(imageUrl: string): Promise<string> {
	const cachedPath = imageUrlCache.get(imageUrl);

	if (cachedPath) {
		return cachedPath;
	}

	const urlExtension = getExtensionFromUrl(imageUrl);
	const hash = getDeterministicHash(imageUrl);

	if (urlExtension) {
		const existingFileName = `${hash}${urlExtension}`;
		const existingFilePath = path.join(BLOG_IMAGE_DIRECTORY, existingFileName);

		if (await fileExists(existingFilePath)) {
			const publicPath = `${BLOG_IMAGE_PUBLIC_BASE_PATH}/${existingFileName}`;
			imageUrlCache.set(imageUrl, publicPath);
			stats.reusedFiles += 1;
			return publicPath;
		}
	}

	const response = await fetch(imageUrl);

	if (!response.ok) {
		throw new Error(`Failed to download ${imageUrl} (${response.status})`);
	}

	const extension =
		urlExtension ??
		getExtensionFromContentType(response.headers.get("content-type"));
	const fileName = `${hash}${extension}`;
	const outputPath = path.join(BLOG_IMAGE_DIRECTORY, fileName);

	if (await fileExists(outputPath)) {
		const publicPath = `${BLOG_IMAGE_PUBLIC_BASE_PATH}/${fileName}`;
		imageUrlCache.set(imageUrl, publicPath);
		stats.reusedFiles += 1;
		return publicPath;
	}

	const fileBuffer = Buffer.from(await response.arrayBuffer());
	await writeFile(outputPath, fileBuffer);

	const publicPath = `${BLOG_IMAGE_PUBLIC_BASE_PATH}/${fileName}`;
	imageUrlCache.set(imageUrl, publicPath);
	stats.downloadedFiles += 1;
	return publicPath;
}

async function rewriteMarkdownImageUrls(content: string): Promise<string> {
	let rewrittenContent = "";
	let lastIndex = 0;

	for (const match of content.matchAll(MARKDOWN_IMAGE_REGEX)) {
		const fullMatch = match[0];
		const prefix = match[1] ?? "";
		const imageUrl = match[2] ?? "";
		const suffix = match[3] ?? ")";
		const matchIndex = match.index ?? 0;

		rewrittenContent += content.slice(lastIndex, matchIndex);

		if (!isHttpUrl(imageUrl)) {
			rewrittenContent += fullMatch;
			lastIndex = matchIndex + fullMatch.length;
			continue;
		}

		try {
			const localPath = await ensureImageDownloaded(imageUrl);
			rewrittenContent += `${prefix}${localPath}${suffix}`;

			if (localPath !== imageUrl) {
				stats.rewrittenUrls += 1;
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.warn(
				`Could not download markdown image URL ${imageUrl}: ${message}`,
			);
			rewrittenContent += fullMatch;
		}

		lastIndex = matchIndex + fullMatch.length;
	}

	rewrittenContent += content.slice(lastIndex);
	return rewrittenContent;
}

async function rewriteHtmlImageUrls(content: string): Promise<string> {
	let rewrittenContent = "";
	let lastIndex = 0;

	for (const match of content.matchAll(HTML_IMAGE_REGEX)) {
		const fullMatch = match[0];
		const prefix = match[1] ?? "";
		const imageUrl = match[2] ?? "";
		const suffix = match[3] ?? "";
		const matchIndex = match.index ?? 0;

		rewrittenContent += content.slice(lastIndex, matchIndex);

		if (!isHttpUrl(imageUrl)) {
			rewrittenContent += fullMatch;
			lastIndex = matchIndex + fullMatch.length;
			continue;
		}

		try {
			const localPath = await ensureImageDownloaded(imageUrl);
			rewrittenContent += `${prefix}${localPath}${suffix}`;

			if (localPath !== imageUrl) {
				stats.rewrittenUrls += 1;
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.warn(`Could not download HTML image URL ${imageUrl}: ${message}`);
			rewrittenContent += fullMatch;
		}

		lastIndex = matchIndex + fullMatch.length;
	}

	rewrittenContent += content.slice(lastIndex);
	return rewrittenContent;
}

async function rewriteBlogPostFile(fileName: string) {
	const filePath = path.join(BLOG_DIRECTORY, fileName);
	const originalFileContents = await readFile(filePath, "utf8");
	const parsed = matter(originalFileContents);
	const frontmatter = { ...parsed.data } as Record<string, unknown>;

	let nextContent = parsed.content;
	let didChange = false;

	for (const field of FRONTMATTER_IMAGE_FIELDS) {
		const fieldValue = frontmatter[field];

		if (typeof fieldValue !== "string" || !isHttpUrl(fieldValue)) {
			continue;
		}

		try {
			const localPath = await ensureImageDownloaded(fieldValue);

			if (localPath !== fieldValue) {
				frontmatter[field] = localPath;
				stats.rewrittenUrls += 1;
				didChange = true;
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.warn(
				`Could not download frontmatter image (${field}) ${fieldValue}: ${message}`,
			);
		}
	}

	const markdownRewrittenContent = await rewriteMarkdownImageUrls(nextContent);
	if (markdownRewrittenContent !== nextContent) {
		didChange = true;
		nextContent = markdownRewrittenContent;
	}

	const htmlRewrittenContent = await rewriteHtmlImageUrls(nextContent);
	if (htmlRewrittenContent !== nextContent) {
		didChange = true;
		nextContent = htmlRewrittenContent;
	}

	if (!didChange) {
		return;
	}

	const rewrittenFileContents = matter.stringify(nextContent, frontmatter);
	await writeFile(filePath, rewrittenFileContents, "utf8");
	stats.updatedPosts += 1;
	console.log(`✓ Rewrote image paths in ${fileName}`);
}

async function downloadBlogImages() {
	console.log("🖼️  Downloading blog images to content/blog/images...");
	await mkdir(BLOG_IMAGE_DIRECTORY, { recursive: true });

	const blogFiles = (await readdir(BLOG_DIRECTORY)).filter((fileName) =>
		fileName.endsWith(".mdx"),
	);

	if (blogFiles.length === 0) {
		console.log("No blog MDX files found in content/blog.");
		return;
	}

	for (const blogFile of blogFiles) {
		await rewriteBlogPostFile(blogFile);
	}

	console.log("\n✅ Blog image localization complete.");
	console.log(`   Updated posts: ${stats.updatedPosts}`);
	console.log(`   Downloaded files: ${stats.downloadedFiles}`);
	console.log(`   Reused files: ${stats.reusedFiles}`);
	console.log(`   Rewritten URLs: ${stats.rewrittenUrls}`);
}

downloadBlogImages().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : "Unknown error";
	console.error(`\n❌ Blog image localization failed: ${message}`);
	process.exit(1);
});
