import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { metadata as invitePageMetadata } from "@/app/join/[inviteCode]/layout";
import { brandAssets } from "@/lib/public-assets";
import { PUBLIC_SITE } from "@/lib/public-site";
import { inviteShareMetadata } from "@/lib/share-metadata";

const document = readFileSync(resolve(process.cwd(), "public/invite-preview.html"), "utf8");
const meta = new Map(
  [...document.matchAll(/<meta (?:property|name)="([^"]+)" content="([^"]*)"\s*\/?\s*>/g)]
    .map((match) => [match[1], match[2]]),
);

describe("invite share metadata", () => {
  it("uses the existing public brand PNG for every static social image URL", () => {
    const imageUrl = "https://www.uttae.app/brand/App_Icon.png";
    expect(inviteShareMetadata.imagePath).toBe("/brand/App_Icon.png");
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
    expect([info.width, info.height]).toEqual([130, 130]);
    expect([inviteShareMetadata.imageWidth, inviteShareMetadata.imageHeight]).toEqual([info.width, info.height]);
    expect(meta.get("og:image:width")).toBe(String(info.width));
    expect(meta.get("og:image:height")).toBe(String(info.height));
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
