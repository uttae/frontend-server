import { cn } from "@/lib/utils";

const AI_OVERLAY_INSET = "0.5rem" as const;
const AI_LABEL_WIDTH_CH = 1.5;

const chatTypographyMessage = {
  bubble: "text-body-s-regular leading-relaxed",
  systemBody: "text-body-s-regular leading-relaxed",
  metaMuted: "text-caption-s-regular leading-relaxed text-dark-gray",
  wooriSenderLabel: "text-caption-s-regular font-medium leading-relaxed text-primary",
  aiRequestBubblePrefix: "text-body-s-emphasis font-semibold leading-relaxed text-secondary",
  placeTitle: "text-body-s-emphasis font-semibold leading-snug text-primary-strong",
  placeRating: "text-body-xs-emphasis font-medium leading-relaxed text-[#364153]",
  placeAddress: "text-body-xs-regular leading-relaxed text-[#99A1AF]",
  input: "text-body-s-regular leading-relaxed",
  inputAiLabel: "text-body-s-emphasis mobile:text-body-m-emphasis leading-relaxed text-secondary font-semibold",
} as const;

const chatTypographyMinimized = {
  bubble: "text-body-xs-regular leading-relaxed",
  systemBody: "text-body-xs-regular leading-relaxed",
  metaMuted: "text-[10px] leading-relaxed text-dark-gray",
  wooriSenderLabel: "text-[10px] font-medium leading-relaxed text-primary",
  aiRequestBubblePrefix: "text-body-xs-emphasis font-semibold leading-relaxed text-secondary",
  placeTitle: "text-body-xs-emphasis font-semibold leading-snug text-primary-strong",
  placeRating: "text-caption-s-regular font-medium leading-relaxed text-[#364153]",
  placeAddress: "text-caption-s-regular leading-relaxed text-[#99A1AF]",
  input: "text-body-xs-regular leading-relaxed",
  inputAiLabel: "text-body-xs-emphasis leading-relaxed text-secondary font-semibold",
} as const;

export type ChatMessageTextTypography =
  | typeof chatTypographyMessage
  | typeof chatTypographyMinimized;

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

export const chatAiBubbleEmphasisClass = "font-semibold text-primary-strong";

export function chatAiBubbleBlockTitleClass(isMinimized: boolean): string {
  return cn(
    "font-semibold text-gray-900",
    isMinimized ? "text-body-xs-regular leading-snug" : "text-body-s-regular leading-snug",
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

export const chatAiBubblePlaceRecommendationEmphasisClass =
  "font-semibold text-primary-strong";

export function chatAiBubblePlaceRecommendationHeadingTitleClass(
  isMinimized: boolean,
): string {
  return cn(
    "font-semibold leading-snug text-[#0f172a]",
    isMinimized ? "text-body-xs-regular" : "text-body-s-regular",
  );
}

export function chatAiBubblePlaceRecommendationHeadingSubtitleClass(
  isMinimized: boolean,
): string {
  return cn(
    "font-normal leading-relaxed text-[#1e293b]",
    isMinimized ? "text-body-xs-regular" : "text-body-s-regular",
  );
}

export function chatAiBubblePlaceRecommendationReasonClass(
  isMinimized: boolean,
): string {
  void isMinimized;
  return cn(
    "font-normal leading-relaxed text-[#1e293b]",
    "text-body-xs-regular",
  );
}
