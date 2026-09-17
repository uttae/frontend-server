import { describe, expect, it } from "vitest";

import {
  NOINDEX_FOLLOW_METADATA,
  NOINDEX_NOFOLLOW_METADATA,
  ORGANIZATION_JSON_LD,
  PUBLIC_INDEXABLE_ROUTES,
  PUBLIC_ROBOT_DISALLOW_PATHS,
  publicPageMetadata,
  SHARE_IMAGE,
  SOFTWARE_APPLICATION_JSON_LD,
} from "@/lib/public-site-metadata";
import { metadata as rootLayoutMetadata } from "@/app/layout";

describe("public site structured data", () => {
  it("describes the operator and both founders with public links", () => {
    expect(ORGANIZATION_JSON_LD).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Team Uttae",
      url: "https://www.uttae.app",
      foundingDate: "2026-06",
      email: "contact@uttae.app",
    });
    expect(ORGANIZATION_JSON_LD).not.toHaveProperty("sameAs");
    expect(ORGANIZATION_JSON_LD.founder).toEqual([
      {
        "@type": "Person",
        name: "김민형",
        alternateName: "Minhyung Kim",
        sameAs: [
          "https://github.com/minbros",
          "https://www.linkedin.com/in/minbros/",
        ],
      },
      {
        "@type": "Person",
        name: "박주영",
        alternateName: "PARK JU YEONG",
        sameAs: [
          "https://github.com/parkjuyeong0312",
          "https://www.linkedin.com/in/%EC%A3%BC%EC%98%81-%EB%B0%95-75a83a2a4/",
        ],
      },
    ]);
  });

  it("describes the public web application without unverified claims", () => {
    expect(SOFTWARE_APPLICATION_JSON_LD).toMatchObject({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "우때 (Uttae)",
      url: "https://www.uttae.app",
      applicationCategory: "TravelApplication",
      operatingSystem: "Web",
    });
    expect(JSON.stringify(SOFTWARE_APPLICATION_JSON_LD)).not.toMatch(
      /"(?:offers|price|isAccessibleForFree|aggregateRating|rating|award|funding|userCount|reviewCount|downloadCount|interactionStatistic)"\s*:|투자/i,
    );
  });

  it("defines the only indexable route allowlist and complete metadata", () => {
    expect(PUBLIC_INDEXABLE_ROUTES.map((entry) => entry.path)).toEqual([
      "/",
      "/terms",
      "/privacy",
      "/operations-policy",
      "/copyright-policy",
    ]);

    const titles = new Set<string>();
    const descriptions = new Set<string>();

    for (const entry of PUBLIC_INDEXABLE_ROUTES) {
      const metadata = publicPageMetadata(entry.path);

      expect(metadata.title).toBe(entry.title);
      expect(metadata.description).toBe(entry.description);
      expect(metadata.robots).toEqual({ index: true, follow: true });
      expect(metadata.alternates?.canonical).toBe(
        new URL(entry.path, "https://www.uttae.app").toString(),
      );
      titles.add(entry.title);
      descriptions.add(entry.description);
    }

    expect(titles.size).toBe(PUBLIC_INDEXABLE_ROUTES.length);
    expect(descriptions.size).toBe(PUBLIC_INDEXABLE_ROUTES.length);
    expect(PUBLIC_ROBOT_DISALLOW_PATHS).toContain("/api/");
    expect(PUBLIC_INDEXABLE_ROUTES.map((entry) => entry.path)).not.toContain(
      "/product",
    );
  });

  it("gives every indexable route an Open Graph and Twitter card image", () => {
    for (const entry of PUBLIC_INDEXABLE_ROUTES) {
      const metadata = publicPageMetadata(entry.path);
      const canonical = new URL(entry.path, "https://www.uttae.app").toString();

      expect(metadata.openGraph).toMatchObject({
        type: "website",
        siteName: "우때",
        locale: "ko_KR",
        url: canonical,
        title: entry.title,
        description: entry.description,
        images: [SHARE_IMAGE],
      });
      expect(metadata.twitter).toMatchObject({
        card: "summary_large_image",
        title: entry.title,
        description: entry.description,
        images: [SHARE_IMAGE.url],
      });
    }
  });

  it("falls back to a default share image for routes that declare no openGraph", () => {
    expect(rootLayoutMetadata.openGraph).toMatchObject({
      type: "website",
      siteName: "우때",
      images: [SHARE_IMAGE],
    });
    expect(rootLayoutMetadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: [SHARE_IMAGE.url],
    });
  });

  it("defines the two non-indexable crawler policies", () => {
    expect(NOINDEX_FOLLOW_METADATA).toEqual({
      robots: { index: false, follow: true },
    });
    expect(NOINDEX_NOFOLLOW_METADATA).toEqual({
      robots: { index: false, follow: false },
    });
  });
});
