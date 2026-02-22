import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { BlogPost } from "@/features/blog/types";

const BLOG_POSTS_DIRECTORY = path.join(process.cwd(), "content/blog");

function getOptionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: undefined;
}

function getOptionalDate(value: unknown): string | undefined {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString();
	}

	if (typeof value === "string" && value.trim().length > 0) {
		return value.trim();
	}

	return undefined;
}

function getOptionalImage(value: unknown): { url: string } | undefined {
	const url = getOptionalString(value);
	return url ? { url } : undefined;
}

function getDateTimestamp(date: string | null | undefined): number | null {
	if (!date) {
		return null;
	}

	const timestamp = new Date(date).getTime();
	return Number.isNaN(timestamp) ? null : timestamp;
}

async function readBlogPostFromFile(
	fileName: string,
): Promise<BlogPost | null> {
	const filePath = path.join(BLOG_POSTS_DIRECTORY, fileName);
	const fileContents = await fs.readFile(filePath, "utf8");
	const { data, content } = matter(fileContents);
	const frontmatter = data as Record<string, unknown>;

	const slug = fileName.replace(/\.mdx$/, "");
	const title = getOptionalString(frontmatter.title) ?? slug;
	const description = getOptionalString(frontmatter.description) ?? "";
	const id = getOptionalString(frontmatter.id) ?? slug;

	return {
		id,
		slug,
		title,
		description,
		image: getOptionalImage(frontmatter.image),
		authorImage: getOptionalImage(frontmatter.authorImage),
		authorName: getOptionalString(frontmatter.authorName),
		authorPosition: getOptionalString(frontmatter.authorPosition),
		date: getOptionalDate(frontmatter.date),
		content: content.trim(),
	};
}

export function sortBlogPosts(posts: BlogPost[]): BlogPost[] {
	return [...posts].sort((left, right) => {
		const leftTimestamp = getDateTimestamp(left.date);
		const rightTimestamp = getDateTimestamp(right.date);

		if (leftTimestamp === null && rightTimestamp === null) {
			return left.slug.localeCompare(right.slug);
		}

		if (leftTimestamp === null) {
			return 1;
		}

		if (rightTimestamp === null) {
			return -1;
		}

		return rightTimestamp - leftTimestamp;
	});
}

export async function getBlogPosts(): Promise<BlogPost[]> {
	try {
		const fileNames = await fs.readdir(BLOG_POSTS_DIRECTORY);
		const mdxFiles = fileNames.filter((fileName) => fileName.endsWith(".mdx"));

		const posts = await Promise.all(
			mdxFiles.map(async (fileName) => readBlogPostFromFile(fileName)),
		);

		return posts.filter((post): post is BlogPost => post !== null);
	} catch {
		return [];
	}
}

export async function getBlogPostsSorted(): Promise<BlogPost[]> {
	const posts = await getBlogPosts();
	return sortBlogPosts(posts);
}
