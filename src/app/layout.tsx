import type { Metadata } from "next";
import "./globals.css";
import { AppRootProviders } from "@/providers/root-providers";
import { faviconAssets } from "@/lib/public-assets";
import { PUBLIC_SITE } from "@/lib/public-site";
import { SHARE_IMAGE } from "@/lib/public-site-metadata";

const DEFAULT_TITLE = "우때 | 올인원 여행 계획 워크스페이스";
const DEFAULT_DESCRIPTION = "우때 | 올인원 여행 계획 워크스페이스";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE.origin),
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  // 자체 openGraph를 선언하지 않는 라우트가 상속하는 기본 링크 프리뷰.
  openGraph: {
    type: "website",
    siteName: PUBLIC_SITE.serviceName,
    locale: "ko_KR",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [SHARE_IMAGE.url],
  },
  icons: {
    icon: [
      { url: faviconAssets.icon32, sizes: "32x32", type: "image/png" },
      { url: faviconAssets.icon16, sizes: "16x16", type: "image/png" },
      { url: faviconAssets.ico },
    ],
    apple: faviconAssets.appleTouchIcon,
    shortcut: faviconAssets.ico,
  },
  manifest: faviconAssets.manifest,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <script
          {...{
            nowprocket: "",
            "data-noptimize": "1",
            "data-cfasync": "false",
            "data-wpfc-render": "false",
            "seraph-accel-crit": "1",
            "data-no-defer": "1",
          }}
          dangerouslySetInnerHTML={{
            __html: `(function () {
  var script = document.createElement("script");
  script.async = 1;
  script.src = 'https://emrldtp.com/NTU0ODU1.js?t=554855';
  document.head.appendChild(script);
})();`,
          }}
        />
      </head>
      <body className="min-h-full w-full flex flex-col">
        <AppRootProviders>{children}</AppRootProviders>
      </body>
    </html>
  );
}
