 

export const BLOG_POST_FIELDS = {
  _id: true,
  _slug: true,
  _title: true,
  title: true,
  description: true,
  image: {
    url: true,
  },
  authorImage: {
    url: true,
  },
  authorName: true,
  authorPosition: true,
  publishedDate: true,
  content: {
    json: {
      content: true,
    },
  },
};

export function generateBlogPostsQuery() {
  // Select all blog post entries defined under the BlogPosts block
  // This avoids maintaining a separate list of known post keys
  const query: any = {
    _title: true,
    simplifyingEmailForDevelopers: BLOG_POST_FIELDS,
    whyEmailTemplatesStickToA600pxWidthAndDoesItStillMatter: BLOG_POST_FIELDS,
  };

  return query;
}

