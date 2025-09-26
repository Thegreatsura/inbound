import { Pump } from "basehub/react-pump";
import { basehub } from "basehub";
import type { Metadata } from "next";
import { BaseHubImage } from "basehub/next-image";
import { SiteHeader } from "@/components/site-header";
import {
  getBlogPostBySlug,
  getPreviousBlogPost,
  getNextBlogPost,
} from "@/features/blog/utils/blog-mapper";
import { BlogNavigation } from "@/features/blog/components/blog-navigation";
import { RichTextRenderer } from "@/features/blog/components/rich-text-renderer";
import { generateBlogPostsQuery } from "@/features/blog/utils/blog-query";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import ArrowBoldLeft from "@/components/icons/arrow-bold-left";
import { Separator } from "@/components/ui/separator";

interface BlogPostPageProps {
  params: {
    slug: string;
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  return (
    <>
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-6 py-10">
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
              <article className="relative flex flex-col gap-3 max-w-none">
                <Button variant="secondary" asChild className="w-fit">
                  <Link href="/blog">
                    <ArrowBoldLeft width="18" height="18" /> All blogs
                  </Link>
                </Button>

                {/* Blog header */}
                <header className="flex flex-col gap-6">
                  {blog.date && (
                    <p className="text-sm text-muted-foreground">
                      {new Date(blog.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  )}

                  <h1 className="text-4xl md:text-5xl leading-tight">
                    {blog.title}
                  </h1>

                  <p className="text-xl text-muted-foreground leading-relaxed">
                    {blog.description}
                  </p>

                  <div className="flex items-center gap-2">
                    {blog.authorImage?.url && (
                      <BaseHubImage
                        src={blog.authorImage.url}
                        alt={blog.authorName || ""}
                        width={38}
                        height={38}
                        className="rounded-full"
                      />
                    )}
                    <div>
                      <p className="font-medium text-foreground">
                        {blog.authorName}
                      </p>
                      {blog.authorPosition && (
                        <p className="text-sm text-muted-foreground">
                          {blog.authorPosition}
                        </p>
                      )}
                    </div>
                  </div>
                </header>

                {blog.image?.url && (
                  <div className="w-full aspect-[16/9] bg-muted flex items-center justify-center rounded-2xl overflow-hidden">
                    <BaseHubImage
                      src={blog.image.url}
                      alt={blog.title}
                      width={800}
                      height={450}
                      className="object-cover w-full h-full"
                      style={{ display: "block" }}
                    />
                  </div>
                )}
                {/* Blog content */}
                <div className="prose max-w-none">
                  {blog.content?.json.content ? (
                    <RichTextRenderer content={blog.content.json.content} />
                  ) : (
                    <p className="text-muted-foreground">
                      Content not available for this blog post.
                    </p>
                  )}
                </div>
                <Separator />

                {/* Blog Navigation */}
                <BlogNavigation
                  previousPost={previousPost}
                  nextPost={nextPost}
                  currentPostTitle={blog.title}
                />
              </article>
            );
          }}
        </Pump>
      </div>
    </>
  );
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { blogPosts } = await basehub().query({
    blogPosts: generateBlogPostsQuery(),
  });

  // Reuse existing mapper to find the specific post
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