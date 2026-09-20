import type { Metadata } from "next";

import { SUPPORT_EMAIL } from "@/lib/contact";
import { brandAssets } from "@/lib/public-assets";
import { PUBLIC_FOUNDERS, PUBLIC_SITE } from "@/lib/public-site";

/** 링크 프리뷰 공용 이미지 — 1.91:1 불투명 PNG. 투명 배경은 카카오톡·슬랙에서 합성 결과가 달라진다. */
export const SHARE_IMAGE = {
  url: brandAssets.shareImage,
  width: 1200,
  height: 630,
  alt: PUBLIC_SITE.serviceName,
} as const;

export const PUBLIC_INDEXABLE_ROUTES = [
  {
    path: "/",
    title: "우때 | 올인원 해외여행 플래너",
    description:
      "우때에서 친구들과 장소를 찾고 대화하며 여행 일정을 함께 완성하세요.",
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/terms",
    title: "우때 | 이용약관",
    description: "우때 서비스 이용 조건과 회원의 권리 및 의무를 안내합니다.",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/privacy",
    title: "우때 | 개인정보 처리방침",
    description: "우때의 개인정보 수집, 이용, 보관 및 보호 방침을 안내합니다.",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/operations-policy",
    title: "우때 | 운영정책",
    description: "우때 서비스의 이용 기준과 운영 원칙을 안내합니다.",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/copyright-policy",
    title: "우때 | 저작권 정책",
    description: "우때 서비스 콘텐츠의 저작권 및 이용 정책을 안내합니다.",
    changeFrequency: "yearly",
    priority: 0.3,
  },
] as const;

export type PublicIndexablePath =
  (typeof PUBLIC_INDEXABLE_ROUTES)[number]["path"];

type PublicPageMetadata = Metadata & {
  title: string;
  description: string;
};

export function publicPageMetadata(
  path: PublicIndexablePath,
): PublicPageMetadata {
  const route = PUBLIC_INDEXABLE_ROUTES.find((entry) => entry.path === path);

  if (!route) {
    throw new Error(`Missing public metadata for ${path}`);
  }

  const canonical = new URL(route.path, PUBLIC_SITE.origin).toString();

  return {
    title: route.title,
    description: route.description,
    robots: { index: true, follow: true },
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: PUBLIC_SITE.serviceName,
      locale: "ko_KR",
      url: canonical,
      title: route.title,
      description: route.description,
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: route.title,
      description: route.description,
      images: [SHARE_IMAGE.url],
    },
  };
}

export const NOINDEX_FOLLOW_METADATA: Metadata = {
  robots: { index: false, follow: true },
};

export const NOINDEX_NOFOLLOW_METADATA: Metadata = {
  robots: { index: false, follow: false },
};

export const PUBLIC_ROBOT_DISALLOW_PATHS = ["/api/"] as const;

export const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Team Uttae",
  alternateName: "팀 우때",
  url: PUBLIC_SITE.origin,
  foundingDate: PUBLIC_SITE.founded,
  email: SUPPORT_EMAIL,
  location: {
    "@type": "Place",
    name: PUBLIC_SITE.location,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Seoul",
      addressCountry: "KR",
    },
  },
  founder: PUBLIC_FOUNDERS.map((founder) => ({
    "@type": "Person",
    name: founder.name,
    alternateName: founder.englishName,
    sameAs: [founder.githubUrl, founder.linkedinUrl],
  })),
} as const;

export const SOFTWARE_APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "우때 (Uttae)",
  url: PUBLIC_SITE.origin,
  applicationCategory: "TravelApplication",
  operatingSystem: "Web",
  browserRequirements: "Requires a modern web browser",
  description:
    "친구들과 장소를 찾고 대화하며 일정과 이동 동선을 완성하는 실시간 협업 여행 플래너",
  featureList: [
    "지도 기반 장소 탐색",
    "실시간 채팅과 장소 공유",
    "날짜별 일정과 이동 동선",
    "여행 맥락 기반 AI 추천과 대화 요약",
  ],
  publisher: {
    "@type": "Organization",
    name: "Team Uttae",
    url: PUBLIC_SITE.origin,
  },
} as const;
