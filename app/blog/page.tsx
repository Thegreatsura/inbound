import { Pump } from "basehub/react-pump";
import Link from "next/link";
import { getBlogPostsSorted } from "@/features/blog/utils/blog-mapper";
import { generateBlogPostsQuery } from "@/features/blog/utils/blog-query";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";

export default async function BlogPage() {
  return (
    <div className="min-h-screen bg-[#fafaf9] text-[#1c1917] selection:bg-[#8161FF]/20">
      <div className="max-w-2xl mx-auto px-6">
        <MarketingNav />

        {/* Hero */}
        <section className="pt-20 pb-12">
          <h1 className="font-heading text-[32px] leading-[1.2] tracking-tight mb-2">Blog</h1>
          <p className="text-[#52525b] leading-relaxed">
            Stay updated with the latest news and updates from inbound.
          </p>
        </section>

        {/* Blog posts */}
        <section className="py-8 border-t border-[#e7e5e4]">
          <Pump
            queries={[
              {
                blogPosts: generateBlogPostsQuery(),
              },
            ]}
          >
            {async ([{ blogPosts }]) => {
              "use server";

              const blogs = getBlogPostsSorted(blogPosts);

              if (blogs.length === 0) {
                return (
                  <div className="text-center py-12">
                    <p className="text-[#52525b]">No blog posts found.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-0">
                  {blogs.map((blog) => (
                    <Link
                      key={blog.id}
                      href={`/blog/${blog.slug}`}
                      className="block py-4 border-b border-[#e7e5e4] hover:bg-white/50 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-[#1c1917] font-medium group-hover:text-[#8161FF] transition-colors">
                            {blog.title}
                          </p>
                          {blog.description && (
                            <p className="text-sm text-[#52525b] mt-1 line-clamp-1">
                              {blog.description}
                            </p>
                          )}
                        </div>
                        {blog.date && (
                          <span className="text-sm text-[#78716c] ml-4 flex-shrink-0">
                            {new Date(blog.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              );
            }}
          </Pump>
        </section>

        <MarketingFooter />
      </div>
    </div>
  );
}
