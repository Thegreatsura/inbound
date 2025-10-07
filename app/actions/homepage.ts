import { basehub } from "basehub";

export async function getHomepageContent() {
  try {
    const data = await basehub().query({
      homepage: {
        _title: true,
        heroPrimaryText: true,
        heroSublineText: true,
        ctaButtonPrimaryText: true,
      },
    });

    return {
      success: true,
      data: data.homepage,
    };
  } catch (error) {
    console.error("Error fetching homepage content:", error);
    return {
      success: false,
      error: "Failed to fetch homepage content",
      data: null,
    };
  }
}

export type HomepageContent = {
  _title: string;
  heroPrimaryText: string;
  heroSublineText: string;
  ctaButtonPrimaryText: string;
};
