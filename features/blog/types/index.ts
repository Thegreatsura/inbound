export type BlogPost = {
	id: string;
	slug: string;
	title: string;
	description: string;
	image?: {
		url: string;
	};
	authorImage?: {
		url: string;
	};
	authorName?: string | null;
	authorPosition?: string | null;
	date?: string | null;
	content: string;
};
