import { Pump } from "basehub/react-pump";
import { basehub } from "basehub";
import type { Metadata } from "next";
import { BaseHubImage } from "basehub/next-image";
import Link from "next/link";
import {
  getBlogPostBySlug,
  getPreviousBlogPost,
  getNextBlogPost,
} from "@/features/blog/utils/blog-mapper";
import { RichTextRenderer } from "@/features/blog/components/rich-text-renderer";
import { generateBlogPostsQuery } from "@/features/blog/utils/blog-query";
import { notFound } from "next/navigation";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";

interface BlogPostPageProps {
  params: {
    slug: string;
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  return (
    <div className="min-h-screen bg-[#fafaf9] text-[#1c1917] selection:bg-[#8161FF]/20">
      <div className="max-w-2xl mx-auto px-6">
        <MarketingNav />

        {/* Content */}
        <Pump
          queries={[
            {
              blogPosts: generateBlogPostsQuery(),
            },
          ]}
        >
          {async ([{ blogPosts }]) => {
            "use server";

            const blog = getBlogPostBySlug(blogPosts, params.slug);

            if (!blog) {
              notFound();
            }

            const previousPost = getPreviousBlogPost(blogPosts, params.slug);
            const nextPost = getNextBlogPost(blogPosts, params.slug);

            return (
              <article>
                {/* Back link */}
                <div className="pt-8 pb-4">
                  <Link
                    href="/blog"
                    className="inline-flex items-center gap-2 text-sm text-[#52525b] hover:text-[#1c1917] transition-colors"
                  >
                    ← All posts
                  </Link>
                </div>

                {/* Article header */}
                <header className="pb-8 border-b border-[#e7e5e4]">
                  {blog.date && (
                    <p className="text-sm text-[#78716c] mb-3">
                      {new Date(blog.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  )}

                  <h1 className="font-heading text-[32px] leading-[1.2] tracking-tight text-[#1c1917] mb-4">
                    {blog.title}
                  </h1>

                  {blog.description && (
                    <p className="text-lg text-[#52525b] leading-relaxed mb-6">
                      {blog.description}
                    </p>
                  )}

                  {/* Author */}
                  <div className="flex items-center gap-3">
                    {blog.authorImage?.url && (
                      <BaseHubImage
                        src={blog.authorImage.url}
                        alt={blog.authorName || ""}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    )}
                    <div>
                      <p className="font-medium text-[#1c1917]">{blog.authorName}</p>
                      {blog.authorPosition && (
                        <p className="text-sm text-[#78716c]">{blog.authorPosition}</p>
                      )}
                    </div>
                  </div>
                </header>

                {/* Featured image */}
                {blog.image?.url && (
                  <div className="py-8">
                    <div className="w-full aspect-[16/9] bg-[#f5f5f4] rounded-xl overflow-hidden">
                      <BaseHubImage
                        src={blog.image.url}
                        alt={blog.title}
                        width={800}
                        height={450}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  </div>
                )}

                {/* Article content */}
                <div className="py-8 prose prose-stone max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-a:text-[#8161FF] prose-a:no-underline hover:prose-a:underline">
                  {blog.content?.json.content ? (
                    <RichTextRenderer content={blog.content.json.content} />
                  ) : (
                    <p className="text-[#78716c]">Content not available for this blog post.</p>
                  )}
                </div>

                {/* Navigation */}
                <div className="py-8 border-t border-[#e7e5e4]">
                  <div className="flex items-center justify-between">
                    {previousPost ? (
                      <Link
                        href={`/blog/${previousPost.slug}`}
                        className="flex items-center gap-2 text-sm text-[#52525b] hover:text-[#1c1917] transition-colors"
                      >
                        ← <span className="max-w-[200px] truncate">{previousPost.title}</span>
                      </Link>
                    ) : (
                      <div />
                    )}
                    {nextPost ? (
                      <Link
                        href={`/blog/${nextPost.slug}`}
                        className="flex items-center gap-2 text-sm text-[#52525b] hover:text-[#1c1917] transition-colors"
                      >
                        <span className="max-w-[200px] truncate">{nextPost.title}</span> →
                      </Link>
                    ) : (
                      <div />
                    )}
                  </div>
                </div>
              </article>
            );
          }}
        </Pump>

        <MarketingFooter />
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { blogPosts } = await basehub().query({
    blogPosts: generateBlogPostsQuery(),
  });

  const { getBlogPostBySlug } = await import("@/features/blog/utils/blog-mapper");
  const blog = getBlogPostBySlug(blogPosts, params.slug);

  if (!blog) {
    return {
      title: "Blog",
    };
  }

  const imageUrl = blog.image?.url || "/opengraph-image.png";

  return {
    title: blog.title,
    description: blog.description,
    openGraph: {
      title: blog.title,
      description: blog.description,
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: blog.title,
      description: blog.description,
      images: [imageUrl],
    },
  };
}
