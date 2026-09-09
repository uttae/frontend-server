import {
  Bot,
  LogIn,
  MapPin,
  MessageCircle,
  Route,
  Send,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { LandingFeatureScreenshotKey } from "@/lib/landing/landing-screenshots";
import { PUBLIC_FOUNDERS } from "@/lib/public-site";

type LandingValue = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export type LandingFeatureStoryContent = {
  id: string;
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  points: readonly string[];
  screenshotKey: Extract<LandingFeatureScreenshotKey, "map" | "placeShare" | "plan">;
};

export type LandingCollaborationFeature = {
  title: string;
  eyebrow: string;
  description: string;
  screenshotKey: Extract<LandingFeatureScreenshotKey, "chat" | "ai">;
  icon: LucideIcon;
};

type LandingHowStep = {
  step: string;
  title: string;
  icon: LucideIcon;
};

export type LandingTeamMember = {
  name: string;
  englishName: string;
  role: string;
  description: string;
  githubUrl: string;
  githubLabel: string;
  linkedinUrl: string;
};

export const LANDING_CONTAINER_CLASS =
  "mx-auto w-full max-w-[1180px] px-5 landing-sm:px-6";
export const LANDING_SECTION_PY = "py-20 landing-lg:py-28";

export const LANDING_VALUES: readonly LandingValue[] = [
  {
    title: "지도 기반 장소 탐색",
    description: "후보 장소를 한눈에 모아요",
    icon: MapPin,
  },
  {
    title: "실시간 팀 협업",
    description: "대화와 계획이 바로 이어져요",
    icon: Users,
  },
  {
    title: "여행 맥락을 아는 AI",
    description: "추천과 요약을 함께 받아요",
    icon: Bot,
  },
];

export const LANDING_FEATURE_STORIES: readonly LandingFeatureStoryContent[] = [
  {
    id: "discover",
    index: "01",
    eyebrow: "DISCOVER",
    title: "지도에서 찾고, 함께 고르기",
    description: "검색과 필터로 장소를 발견하고 팀 북마크에 모아 후보를 비교합니다.",
    points: ["카테고리별 장소 탐색", "조건에 맞는 필터", "팀 북마크 공유"],
    screenshotKey: "map",
  },
  {
    id: "connect",
    index: "02",
    eyebrow: "CONNECT",
    title: "장소 정보가 대화와 일정으로 바로 연결",
    description:
      "사진·평점·주소가 담긴 장소 카드를 채팅으로 보내고, 북마크나 일정에 곧바로 추가합니다.",
    points: ["채팅으로 보내기", "북마크에 저장", "일정에 바로 추가"],
    screenshotKey: "placeShare",
  },
  {
    id: "plan-story",
    index: "03",
    eyebrow: "PLAN",
    title: "날짜별 일정과 이동 동선을 완성",
    description:
      "시작·종료 시각과 메모를 정리하고, 드래그로 순서를 조정하며 이동 경로까지 확인합니다.",
    points: ["날짜·시간·메모", "드래그 순서 조정", "이동수단과 지도 경로"],
    screenshotKey: "plan",
  },
];

export const LANDING_COLLABORATION_FEATURES: readonly LandingCollaborationFeature[] = [
  {
    title: "실시간 채팅",
    eyebrow: "REAL-TIME CHAT",
    description: "장소 카드를 공유하며 계획을 바로 의논합니다.",
    screenshotKey: "chat",
    icon: MessageCircle,
  },
  {
    title: "팀과 함께 쓰는 AI",
    eyebrow: "WOORI AI",
    description: "대화 맥락에 맞는 추천과 긴 대화의 요약을 받습니다.",
    screenshotKey: "ai",
    icon: Send,
  },
];

export const LANDING_HOW_STEPS: readonly LandingHowStep[] = [
  { step: "01", title: "로그인하고 여행 방 만들기", icon: LogIn },
  { step: "02", title: "친구를 초대해 함께 장소 고르기", icon: UserPlus },
  { step: "03", title: "일정과 이동 동선 완성하기", icon: Route },
];

export const LANDING_TEAM_MEMBERS: readonly LandingTeamMember[] = PUBLIC_FOUNDERS.map(
  (founder) => ({
    ...founder,
    description: "서울시립대학교 컴퓨터과학부",
  }),
);
