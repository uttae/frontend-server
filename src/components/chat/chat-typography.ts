import { cn } from "@/lib/utils";

const AI_OVERLAY_INSET = "0.5rem" as const;
const AI_LABEL_WIDTH_CH = 1.5;

/** 말풍선·카드·입력 등 본문 (패널 일반 크기) */
const chatTypographyMessage = {
  bubble: "text-body-s-regular mobile:text-body-xs-regular leading-relaxed",
  systemBody: "text-body-s-regular mobile:text-body-xs-regular leading-relaxed",
  metaMuted: "text-caption-s-regular leading-relaxed text-dark-gray",
  wooriSenderLabel: "text-caption-s-regular font-medium leading-relaxed text-primary",
  aiRequestBubblePrefix: "text-body-s-emphasis mobile:text-body-xs-emphasis font-semibold leading-relaxed text-secondary-default",
  placeTitle: "text-body-s-emphasis mobile:text-body-xs-emphasis font-semibold leading-snug text-primary-strong",
  placeRating: "text-body-xs-emphasis font-medium leading-relaxed text-[#364153]",
  placeAddress: "text-body-xs-regular leading-relaxed text-[#99A1AF]",
  input: "text-body-s-regular leading-relaxed",
  inputAiLabel: "text-body-s-emphasis leading-relaxed text-secondary-default font-semibold",
} as const;

/** 패널 최소화(좁은 폭) */
const chatTypographyMinimized = {
  bubble: "text-body-xs-regular leading-relaxed",
  systemBody: "text-body-xs-regular leading-relaxed",
  metaMuted: "text-[10px] leading-relaxed text-dark-gray",
  wooriSenderLabel: "text-[10px] font-medium leading-relaxed text-primary",
  aiRequestBubblePrefix: "text-body-xs-emphasis font-semibold leading-relaxed text-secondary-default",
  placeTitle: "text-body-xs-emphasis font-semibold leading-snug text-primary-strong",
  placeRating: "text-caption-s-regular font-medium leading-relaxed text-[#364153]",
  placeAddress: "text-caption-s-regular leading-relaxed text-[#99A1AF]",
  input: "text-body-xs-regular leading-relaxed",
  inputAiLabel: "text-body-xs-emphasis leading-relaxed text-secondary-default font-semibold",
} as const;

export type ChatMessageTextTypography =
  | typeof chatTypographyMessage
  | typeof chatTypographyMinimized;

/**
 * 채팅 패널 타이포 — 메시지/카드/입력 + textarea 오버레이 여백.
 * 최소화 시 본문만 축소; 오버레이 들여쓰기 토큰은 동일.
 */
export const chatTypography = {
  ...chatTypographyMessage,
  aiOverlayInset: AI_OVERLAY_INSET,
  aiInputPaddingLeft: `calc(${AI_OVERLAY_INSET} + ${AI_LABEL_WIDTH_CH}ch)`,
} as const;

export function resolveChatMessageTypography(
  isMinimized: boolean,
): ChatMessageTextTypography {
  return isMinimized ? chatTypographyMinimized : chatTypographyMessage;
}

/**
 * AI 응답 말풍선(밝은 배경) 위 `**강조**` — 진한 본문과 대비되게 브랜드 그린으로 강조.
 */
export const chatAiBubbleEmphasisClass = "font-semibold text-primary-strong";

/** AI 응답 말풍선(밝은 배경) 내 대화 요약 등 블록 제목 */
export function chatAiBubbleBlockTitleClass(isMinimized: boolean): string {
  return cn(
    "font-semibold text-gray-900",
    isMinimized ? "text-body-xs-regular leading-snug" : "text-body-s-regular mobile:text-body-xs-regular leading-snug",
  );
}

export function chatAiBubbleSectionLabelClass(isMinimized: boolean): string {
  void isMinimized;
  return cn(
    "font-semibold text-gray-900",
    "text-body-xs-regular",
  );
}

export function chatAiBubbleOverviewBodyClass(isMinimized: boolean): string {
  void isMinimized;
  return cn(
    "leading-relaxed text-gray-700",
    "text-body-xs-regular",
  );
}

export function chatAiBubbleListTextClass(isMinimized: boolean): string {
  void isMinimized;
  return cn(
    "text-gray-800",
    "text-body-xs-regular leading-snug",
  );
}

/** AI 장소 추천 블록·reason 공통 `**강조**` — 본문 슬레이트 톤과 어울리는 브랜드 그린 */
export const chatAiBubblePlaceRecommendationEmphasisClass =
  "font-semibold text-primary-strong";

/** 장소 추천 블록 헤더 `heading.title` — 본문·reason과 맞춘 어두운 계열 */
export function chatAiBubblePlaceRecommendationHeadingTitleClass(
  isMinimized: boolean,
): string {
  return cn(
    "font-semibold leading-snug text-[#0f172a]",
    isMinimized ? "text-body-xs-regular" : "text-body-s-regular mobile:text-body-xs-regular",
  );
}

/** 장소 추천 블록 헤더 `heading.subtitle` (예: 요청 맥락 안내 문장) */
export function chatAiBubblePlaceRecommendationHeadingSubtitleClass(
  isMinimized: boolean,
): string {
  return cn(
    "font-normal leading-relaxed text-[#1e293b]",
    isMinimized ? "text-body-xs-regular" : "text-body-s-regular mobile:text-body-xs-regular",
  );
}

/** AI 장소 추천 행 카드 아래 `reason`(장소 설명) 본문 — 말풍선 위에서 일반 본문처럼 읽히도록 어두운 색 */
export function chatAiBubblePlaceRecommendationReasonClass(
  isMinimized: boolean,
): string {
  void isMinimized;
  return cn(
    "font-normal leading-relaxed text-[#1e293b]",
    "text-body-xs-regular",
  );
}
