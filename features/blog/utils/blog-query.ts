 

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
   // Query blog posts from the dynamic list structure
   const query: any = {
     _title: true,
     blogPosts: {
       items: BLOG_POST_FIELDS,
       _meta: {
         totalCount: true,
       },
     },
   };

   return query;
 }

