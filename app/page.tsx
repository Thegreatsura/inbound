import { SiteHeader } from "@/components/site-header";
import Hero from "@/components/landing/hero";
import { getHomepageContent } from "./actions/homepage";

export default async function HomePage() {
  const homepageResult = await getHomepageContent();

  // Fallback content in case of error
  const content =
    homepageResult.success && homepageResult.data
      ? homepageResult.data
      : {
          _title: "HomePage",
          heroPrimaryText: "Email platform for builders",
          heroSublineText:
            "A complete email platform for Developers to Send, Receive & Reply",
          ctaButtonPrimaryText: "Get Started",
        };

  return (
    <div className="min-h-screen relative">
      <SiteHeader />
      <section className="max-w-7xl mx-auto">
        <Hero content={content} />
      </section>
    </div>
  );
}
