import type { MetadataRoute } from "next";

/**
 * Keep the CRM out of search results entirely.
 *
 * Nothing links here, but that is not a defence: every TLS certificate issued
 * for crm.eaglebuilt.ai is published to public certificate transparency logs,
 * which crawlers read. The subdomain is discoverable the moment it has HTTPS.
 *
 * This blocks crawling; the `robots` metadata in layout.tsx separately says
 * noindex, because a URL found elsewhere can still be listed on the strength
 * of a robots.txt block alone.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
