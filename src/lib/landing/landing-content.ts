import {
  Bot,
  LogIn,
  MapPin,
  Route,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

import { PUBLIC_FOUNDERS } from "@/lib/public-site";

type LandingValue = {
  title: string;
  description: string;
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
