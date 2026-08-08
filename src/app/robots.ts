import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Organizer views and individual registrations hold participants'
      // personal details. Neither belongs in an index.
      disallow: ["/organizer", "/registration/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
