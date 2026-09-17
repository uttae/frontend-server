import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { metadata as landingPageMetadata } from "@/app/page";
import { metadata as invitePageMetadata } from "@/app/join/[inviteCode]/layout";
import { brandAssets } from "@/lib/public-assets";
import { PUBLIC_SITE } from "@/lib/public-site";
import { SHARE_IMAGE } from "@/lib/public-site-metadata";
import { inviteShareMetadata } from "@/lib/share-metadata";

const document = readFileSync(resolve(process.cwd(), "public/invite-preview.html"), "utf8");
const meta = new Map(
  [...document.matchAll(/<meta (?:property|name)="([^"]+)" content="([^"]*)"\s*\/?\s*>/g)]
    .map((match) => [match[1], match[2]]),
);

describe("invite share metadata", () => {
  it("uses the existing public brand PNG for every static social image URL", () => {
    const imageUrl = "https://www.uttae.app/brand/og_image.png";
    expect(inviteShareMetadata.imagePath).toBe("/brand/og_image.png");
    expect(inviteShareMetadata.imagePath).toBe(brandAssets.shareImage);
    expect(new URL(inviteShareMetadata.imagePath, PUBLIC_SITE.origin).href).toBe(imageUrl);
    for (const key of ["og:image", "og:image:secure_url", "twitter:image"]) {
      expect(meta.get(key)).toBe(imageUrl);
    }
    expect(meta.get("og:image:type")).toBe("image/png");
    expect(meta.get("twitter:card")).toBe("summary_large_image");
  });

  it("declares the real, decodable PNG dimensions in both metadata sources", async () => {
    const bytes = readFileSync(resolve(process.cwd(), `public${inviteShareMetadata.imagePath}`));
    const metadata = await sharp(bytes).metadata();
    const { info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });

    expect(metadata.format).toBe("png");
    expect([info.width, info.height]).toEqual([1200, 630]);
    expect([inviteShareMetadata.imageWidth, inviteShareMetadata.imageHeight]).toEqual([info.width, info.height]);
    expect(meta.get("og:image:width")).toBe(String(info.width));
    expect(meta.get("og:image:height")).toBe(String(info.height));
  });

  it("ships an opaque 1.91:1 image so link previews never composite transparency", async () => {
    const bytes = readFileSync(resolve(process.cwd(), `public${SHARE_IMAGE.url}`));
    const metadata = await sharp(bytes).metadata();

    const ratio = SHARE_IMAGE.width / SHARE_IMAGE.height;

    expect(metadata.hasAlpha).toBe(false);
    // og:image 권장 비율 1.91:1 — 벗어나면 summary_large_image 카드에서 잘린다.
    expect(ratio).toBeGreaterThan(1.9);
    expect(ratio).toBeLessThan(1.92);
  });

  it("uses the same image and real dimensions on the landing page", () => {
    expect(landingPageMetadata.openGraph).toMatchObject({
      images: [{ url: "/brand/og_image.png", width: 1200, height: 630 }],
    });
    expect(landingPageMetadata.twitter).toMatchObject({ images: ["/brand/og_image.png"] });
  });

  it("keeps the static title and descriptions aligned with shared metadata", () => {
    expect(document).toContain(`<title>${inviteShareMetadata.title}</title>`);
    for (const key of ["og:title", "twitter:title"]) {
      expect(meta.get(key)).toBe(inviteShareMetadata.title);
    }
    for (const key of ["description", "og:description", "twitter:description"]) {
      expect(meta.get(key)).toBe(inviteShareMetadata.description);
    }
    expect(meta.get("og:site_name")).toBe(PUBLIC_SITE.serviceName);
  });

  it("agrees with the actual invite page Open Graph and Twitter metadata", () => {
    expect(invitePageMetadata.openGraph).toMatchObject({
      title: meta.get("og:title"),
      description: meta.get("og:description"),
      images: [{
        url: inviteShareMetadata.imagePath,
        width: Number(meta.get("og:image:width")),
        height: Number(meta.get("og:image:height")),
      }],
    });
    expect(invitePageMetadata.twitter).toMatchObject({
      card: meta.get("twitter:card"),
      title: meta.get("twitter:title"),
      description: meta.get("twitter:description"),
      images: [inviteShareMetadata.imagePath],
    });
  });
});
