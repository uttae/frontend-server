"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageCircleMore,
  Settings,
  Users,
} from "lucide-react";
import type { CSSProperties, ComponentType } from "react";
import { useEffect, useId, useRef, useState } from "react";

import { useSessionUser } from "@/hooks/useSessionUser";
import { completeTutorial } from "@/lib/api/user";
import {
  AnalyticsEvents,
  buildTutorialExitAnalyticsEvent,
  trackAnalyticsEvent,
  TUTORIAL_ANALYTICS_VERSION,
  type TutorialExitReason,
} from "@/lib/analytics/track";
import { sessionUserQueryKey } from "@/lib/query-keys";
import type { SessionUser } from "@/lib/session-user";

type TutorialStep = {
  target: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; size?: number }>;
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    target: "chat",
    eyebrow: "함께 이야기하기",
    title: "채팅",
    description:
      "여행 멤버들과 실시간으로 대화하고, AI에게 여행지 추천도 받아보세요.",
    icon: MessageCircleMore,
  },
  {
    target: "search",
    eyebrow: "가고 싶은 곳 찾기",
    title: "장소 검색",
    description:
      "관광지, 맛집, 숙소를 검색하고 지도에서 위치와 상세 정보를 확인할 수 있어요.",
    icon: MapPin,
  },
  {
    target: "plan",
    eyebrow: "여행 동선 만들기",
    title: "일정",
    description:
      "날짜별로 장소를 추가하고 순서를 정해 우리만의 여행 일정을 완성해 보세요.",
    icon: CalendarDays,
  },
  {
    target: "bookmark",
    eyebrow: "후보 장소 모아두기",
    title: "북마크",
    description:
      "마음에 드는 장소를 폴더별로 저장하고, 필요할 때 일정에 바로 추가할 수 있어요.",
    icon: Bookmark,
  },
  {
    target: "member-settings",
    eyebrow: "여행 멤버와 함께하기",
    title: "멤버 관리",
    description:
      "초대 링크로 새 멤버를 부르고, 함께 여행을 준비하는 멤버들을 관리할 수 있어요.",
    icon: Users,
  },
  {
    target: "room-settings",
    eyebrow: "여행 정보 다듬기",
    title: "여행 설정",
    description:
      "여행 이름과 기간 등 방의 기본 정보를 확인하고 수정할 수 있어요.",
    icon: Settings,
  },
];

type TargetRect = {
  top: number;
  left: number;
  right: number;
  width: number;
  height: number;
};

const SPOTLIGHT_PADDING = 6;
const CARD_HEIGHT_ESTIMATE = 330;

export function SidebarTutorial() {
  const { data: user } = useSessionUser();
  const queryClient = useQueryClient();
  const maskId = useId().replaceAll(":", "");
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const tutorialBeginTrackedRef = useRef(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isOpen = user?.tutorialCompleted === false;
  const step = TUTORIAL_STEPS[stepIndex];
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;
  const tutorialVisible = isOpen && targetRect !== null;

  useEffect(() => {
    if (!isOpen) return;

    const updateTargetRect = () => {
      const target = document.querySelector<HTMLElement>(
        `[data-tutorial-target="${step.target}"]`,
      );
      if (!target) {
        setTargetRect(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      });
    };

    updateTargetRect();
    window.addEventListener("resize", updateTargetRect);
    return () => window.removeEventListener("resize", updateTargetRect);
  }, [isOpen, step.target]);

  useEffect(() => {
    if (!isOpen || !targetRect) return;
    primaryButtonRef.current?.focus();
  }, [isOpen, stepIndex, targetRect]);

  useEffect(() => {
    if (!tutorialVisible || tutorialBeginTrackedRef.current) return;

    tutorialBeginTrackedRef.current = true;
    trackAnalyticsEvent(AnalyticsEvents.tutorialBegin, {
      tutorial_version: TUTORIAL_ANALYTICS_VERSION,
    });
  }, [tutorialVisible]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isCompleting) return;
      if (event.key === "ArrowLeft" && stepIndex > 0) {
        setErrorMessage(null);
        setStepIndex((current) => current - 1);
      }
      if (event.key === "ArrowRight" && !isLastStep) {
        setErrorMessage(null);
        setStepIndex((current) => current + 1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isCompleting, isLastStep, isOpen, stepIndex]);

  if (!isOpen || !targetRect) return null;

  const spotlight = {
    x: targetRect.left - SPOTLIGHT_PADDING,
    y: targetRect.top - SPOTLIGHT_PADDING,
    width: targetRect.width + SPOTLIGHT_PADDING * 2,
    height: targetRect.height + SPOTLIGHT_PADDING * 2,
  };
  const cardTop = Math.min(
    Math.max(20, targetRect.top + targetRect.height / 2 - CARD_HEIGHT_ESTIMATE / 2),
    Math.max(20, window.innerHeight - CARD_HEIGHT_ESTIMATE - 20),
  );
  const arrowTop = Math.min(
    Math.max(28, targetRect.top + targetRect.height / 2 - cardTop - 9),
    CARD_HEIGHT_ESTIMATE - 28,
  );
  const cardStyle: CSSProperties = {
    left: targetRect.right + 24,
    top: cardTop,
    maxWidth: `calc(100vw - ${targetRect.right + 44}px)`,
  };

  const finishTutorial = async (reason: TutorialExitReason) => {
    if (isCompleting) return;
    setIsCompleting(true);
    setErrorMessage(null);

    try {
      const analyticsEvent = buildTutorialExitAnalyticsEvent(reason, stepIndex);
      await completeTutorial();

      queryClient.setQueryData<SessionUser | null>(
        sessionUserQueryKey,
        (current) =>
          current ? { ...current, tutorialCompleted: true } : current,
      );
      if (analyticsEvent.eventName === AnalyticsEvents.tutorialSkip) {
        trackAnalyticsEvent(analyticsEvent.eventName, analyticsEvent.params);
      } else {
        trackAnalyticsEvent(
          analyticsEvent.eventName,
          analyticsEvent.params,
        );
      }
    } catch {
      setErrorMessage("완료 상태를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setIsCompleting(false);
    }
  };

  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-[100]" aria-live="polite">
      <svg
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        width="100%"
        height="100%"
      >
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={spotlight.x}
              y={spotlight.y}
              width={spotlight.width}
              height={spotlight.height}
              rx="18"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgb(15 23 42 / 0.68)"
          mask={`url(#${maskId})`}
        />
      </svg>

      <div
        className="pointer-events-none fixed rounded-[18px] border-2 border-white shadow-[0_0_0_4px_rgba(1,131,255,0.45),0_0_24px_rgba(255,255,255,0.35)]"
        style={{
          left: spotlight.x,
          top: spotlight.y,
          width: spotlight.width,
          height: spotlight.height,
        }}
        aria-hidden="true"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sidebar-tutorial-title"
        aria-describedby="sidebar-tutorial-description"
        className="fixed w-[min(23rem,calc(100vw-7rem))] overflow-visible rounded-3xl bg-white p-6 shadow-2xl"
        style={cardStyle}
      >
        <span
          className="absolute -left-2.5 h-5 w-5 rotate-45 bg-white"
          style={{ top: arrowTop }}
          aria-hidden="true"
        />

        <div className="relative">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon size={24} />
            </div>
            {!isLastStep ? (
              <button
                type="button"
                onClick={() => void finishTutorial("skip")}
                disabled={isCompleting}
                className="rounded-lg px-2 py-1 text-[14px] font-medium text-dark-gray transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                건너뛰기
              </button>
            ) : null}
          </div>

          <p className="text-[14px] font-semibold tracking-wide text-primary">
            {step.eyebrow}
          </p>
          <h2 id="sidebar-tutorial-title" className="mt-1 text-2xl font-bold text-gray-950">
            {step.title}
          </h2>
          <p
            id="sidebar-tutorial-description"
            className="mt-2 min-h-15 text-[17px] leading-6 text-dark-gray"
          >
            {step.description}
          </p>

          <div className="mt-5 flex items-center gap-1.5" aria-label={`${stepIndex + 1} / ${TUTORIAL_STEPS.length} 단계`}>
            {TUTORIAL_STEPS.map((tutorialStep, index) => (
              <span
                key={tutorialStep.target}
                className={`h-1.5 rounded-full transition-all ${
                  index === stepIndex ? "w-6 bg-primary" : "w-1.5 bg-gray-300"
                }`}
                aria-hidden="true"
              />
            ))}
            <span className="ml-2 text-[14px] font-medium text-dark-gray">
              {stepIndex + 1} / {TUTORIAL_STEPS.length}
            </span>
          </div>

          {errorMessage ? (
            <p className="mt-3 text-[14px] font-medium text-status-negative" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-5 flex gap-2">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setStepIndex((current) => current - 1);
                }}
                disabled={isCompleting}
                className="flex h-11 items-center justify-center gap-1 rounded-xl border border-gray-border px-4 text-[17px] font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={17} />
                이전
              </button>
            ) : null}
            <button
              ref={primaryButtonRef}
              type="button"
              onClick={() => {
                if (isLastStep) {
                  void finishTutorial("complete");
                  return;
                }
                setErrorMessage(null);
                setStepIndex((current) => current + 1);
              }}
              disabled={isCompleting}
              className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-4 text-[17px] font-semibold text-white transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCompleting ? "저장 중…" : isLastStep ? "튜토리얼 완료" : "다음"}
              {!isLastStep && !isCompleting ? <ChevronRight size={17} /> : null}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
