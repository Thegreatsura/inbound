#!/usr/bin/env bun

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIRECTORY = path.join(process.cwd(), "content/blog");
const BASEHUB_GRAPHQL_ENDPOINT = "https://api.basehub.com/graphql";

const BASEHUB_EXPORT_QUERY = `
query ExportBlogPosts {
  blogPosts {
    blogPosts {
      items {
        _id
        _slug
        title
        description
        image {
          url
        }
        authorImage {
          url
        }
        authorName
        authorPosition
        publishedDate
        content {
          json {
            content
          }
        }
      }
    }
  }
}
`;

interface RichTextMark {
	type: string;
	attrs?: Record<string, unknown>;
}

interface RichTextNode {
	type: string;
	text?: string;
	attrs?: Record<string, unknown>;
	marks?: RichTextMark[];
	content?: RichTextNode[];
}

interface BasehubImage {
	url?: string | null;
}

interface BasehubRichText {
	json?: {
		content?: RichTextNode[] | null;
	} | null;
}

interface BasehubBlogPost {
	_id: string;
	_slug: string;
	title: string;
	description?: string | null;
	image?: BasehubImage | null;
	authorImage?: BasehubImage | null;
	authorName?: string | null;
	authorPosition?: string | null;
	publishedDate?: string | null;
	content?: BasehubRichText | null;
}

interface BlogQueryResult {
	blogPosts?: {
		blogPosts?: {
			items?: BasehubBlogPost[];
		};
	};
}

interface BasehubGraphQLError {
	message: string;
}

interface BasehubGraphQLResponse {
	data?: BlogQueryResult;
	errors?: BasehubGraphQLError[];
}

function getOptionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: undefined;
}

function getCodeFence(content: string): string {
	const matches = content.match(/`{3,}/g);
	const maxFenceLength = matches
		? Math.max(...matches.map((match) => match.length))
		: 2;

	return "`".repeat(Math.max(3, maxFenceLength + 1));
}

function applyMarks(text: string, marks: RichTextMark[] = []): string {
	return marks.reduce((current, mark) => {
		if (mark.type === "bold") {
			return `**${current}**`;
		}

		if (mark.type === "italic") {
			return `*${current}*`;
		}

		if (mark.type === "link") {
			const href = getOptionalString(mark.attrs?.href);
			return href ? `[${current}](${href})` : current;
		}

		return current;
	}, text);
}

function extractNodeText(nodes: RichTextNode[] = []): string {
	return nodes
		.map((node) => {
			if (node.type === "text") {
				return node.text ?? "";
			}

			if (node.type === "hardBreak") {
				return "\n";
			}

			return extractNodeText(node.content ?? []);
		})
		.join("");
}

function serializeInlineNodes(nodes: RichTextNode[] = []): string {
	return nodes
		.map((node) => {
			if (node.type === "text") {
				return applyMarks(node.text ?? "", node.marks);
			}

			if (node.type === "hardBreak") {
				return "  \n";
			}

			return serializeNode(node, 0);
		})
		.join("");
}

function serializeListItem(node: RichTextNode, depth: number): string {
	const prefix = `${"  ".repeat(depth)}- `;
	const children = node.content ?? [];

	if (children.length === 0) {
		return prefix.trimEnd();
	}

	const blocks = children
		.map((child) => serializeNode(child, depth + 1))
		.filter((segment) => segment.trim().length > 0);

	if (blocks.length === 0) {
		return prefix.trimEnd();
	}

	const firstBlock = blocks[0]?.trim() ?? "";
	const remainingBlocks = blocks.slice(1);

	if (remainingBlocks.length === 0) {
		return `${prefix}${firstBlock}`;
	}

	const indentation = "  ".repeat(depth + 1);
	const rest = remainingBlocks
		.map((segment) =>
			segment
				.split("\n")
				.map((line) => `${indentation}${line}`)
				.join("\n"),
		)
		.join("\n");

	return `${prefix}${firstBlock}\n${rest}`;
}

function serializeBulletList(node: RichTextNode, depth: number): string {
	const items = (node.content ?? [])
		.filter((child) => child.type === "listItem")
		.map((child) => serializeListItem(child, depth));

	return items.join("\n");
}

function serializeNode(node: RichTextNode, depth: number): string {
	switch (node.type) {
		case "paragraph":
			return serializeInlineNodes(node.content ?? []);
		case "heading": {
			const rawLevel = node.attrs?.level;
			const headingLevel =
				typeof rawLevel === "number" && rawLevel >= 1 && rawLevel <= 6
					? rawLevel
					: 2;

			return `${"#".repeat(headingLevel)} ${serializeInlineNodes(node.content ?? [])}`;
		}
		case "bulletList":
			return serializeBulletList(node, depth);
		case "listItem":
			return serializeListItem(node, depth);
		case "codeBlock": {
			const language = getOptionalString(node.attrs?.language) ?? "";
			const code = extractNodeText(node.content ?? []);
			const fence = getCodeFence(code);

			return `${fence}${language}\n${code}\n${fence}`;
		}
		case "image": {
			const src = getOptionalString(node.attrs?.src);

			if (!src) {
				return "";
			}

			const caption = getOptionalString(node.attrs?.caption) ?? "";
			return `![${caption}](${src})`;
		}
		case "horizontalRule":
			return "---";
		case "text":
			return applyMarks(node.text ?? "", node.marks);
		case "hardBreak":
			return "  \n";
		default:
			return serializeInlineNodes(node.content ?? []);
	}
}

function serializeRichText(nodes: RichTextNode[]): string {
	const markdownBlocks = nodes
		.map((node) => serializeNode(node, 0).trim())
		.filter((block) => block.length > 0);

	return markdownBlocks.join("\n\n");
}

function yamlValue(value: string): string {
	return JSON.stringify(value);
}

function toMdxDocument(post: BasehubBlogPost): string {
	const frontmatter: string[] = [
		"---",
		`title: ${yamlValue(post.title)}`,
		`description: ${yamlValue(post.description ?? "")}`,
		`id: ${yamlValue(post._id)}`,
	];

	if (post.publishedDate) {
		frontmatter.push(`date: ${yamlValue(post.publishedDate)}`);
	}

	if (post.image?.url) {
		frontmatter.push(`image: ${yamlValue(post.image.url)}`);
	}

	if (post.authorName) {
		frontmatter.push(`authorName: ${yamlValue(post.authorName)}`);
	}

	if (post.authorPosition) {
		frontmatter.push(`authorPosition: ${yamlValue(post.authorPosition)}`);
	}

	if (post.authorImage?.url) {
		frontmatter.push(`authorImage: ${yamlValue(post.authorImage.url)}`);
	}

	frontmatter.push("---");

	const body = serializeRichText(post.content?.json?.content ?? []);
	return `${frontmatter.join("\n")}\n\n${body}\n`;
}

async function getBasehubBlogPosts(): Promise<BasehubBlogPost[]> {
	const token = process.env.BASEHUB_TOKEN;

	if (!token) {
		throw new Error("BASEHUB_TOKEN is required to export blog posts.");
	}

	const response = await fetch(BASEHUB_GRAPHQL_ENDPOINT, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			query: BASEHUB_EXPORT_QUERY,
		}),
	});

	if (!response.ok) {
		throw new Error(
			`Basehub query failed with status ${response.status}: ${response.statusText}`,
		);
	}

	const payload = (await response.json()) as BasehubGraphQLResponse;

	if (payload.errors && payload.errors.length > 0) {
		const errorMessages = payload.errors
			.map((error) => error.message)
			.join("; ");
		throw new Error(`Basehub returned GraphQL errors: ${errorMessages}`);
	}

	return payload.data?.blogPosts?.blogPosts?.items ?? [];
}

async function exportBlogPostsToMdx() {
	console.log("📝 Exporting Basehub blog posts to MDX...");
	await mkdir(OUTPUT_DIRECTORY, { recursive: true });

	const blogPosts = await getBasehubBlogPosts();

	if (blogPosts.length === 0) {
		console.log("No blog posts found in Basehub.");
		return;
	}

	let writtenCount = 0;

	for (const blogPost of blogPosts) {
		if (!blogPost._slug || !blogPost.title) {
			console.warn(`Skipping post with missing slug/title (${blogPost._id}).`);
			continue;
		}

		const outputPath = path.join(OUTPUT_DIRECTORY, `${blogPost._slug}.mdx`);
		const mdxDocument = toMdxDocument(blogPost);

		await writeFile(outputPath, mdxDocument, "utf8");
		writtenCount += 1;

		console.log(`✓ ${blogPost._slug}.mdx`);
	}

	console.log(
		`\n✅ Export complete. Wrote ${writtenCount} MDX files to content/blog.`,
	);
}

exportBlogPostsToMdx().catch((error: unknown) => {
	const message =
		error instanceof Error ? error.message : "Unknown export error occurred.";

	console.error(`\n❌ Blog export failed: ${message}`);
	process.exit(1);
});
