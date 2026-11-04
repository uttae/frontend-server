import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Figma DS에 인라인 Alert가 없어 지금 화면의 안내 상자 모양을 옮긴다.
// lg는 로그인·약관 동의 화면 상자, md는 장소 상세·모바일 장소 검색·준비물 상자다.
// brand의 테두리·바탕은 지금 쓰는 primary/35·primary/[0.06](합성색 #9ccfff·#f0f8ff)에 맞는 시맨틱 토큰이 없어 가장 가까운 원시 색을 쓴다
const alertVariants = cva("group/alert flex border text-left", {
  variants: {
    tone: {
      neutral: "border-border-subtle bg-fill-subtle text-text",
      brand: "border-[var(--blue-300)] bg-[var(--blue-50)] text-primary",
      warning: "border-status-cautionary bg-fill-subtle text-text",
    },
    size: {
      lg: "rounded-xl px-4 py-3 text-body-m-regular mobile:text-body-s-regular",
      md: "rounded-md p-3 text-body-s-regular",
    },
    // 모바일 장소 검색·준비물 상자는 동작이 문구 바로 옆에 있다(horizontal)
    orientation: {
      vertical: "flex-col gap-1",
      horizontal: "items-center gap-2",
    },
  },
  defaultVariants: { tone: "neutral", size: "md", orientation: "vertical" },
});

/**
 * 급하지 않은 안내는 role="status"로 덮는다.
 * 폭을 정하지 않는다. w-full에 바깥 margin을 더하면 넘치므로 간격은 부모가 주고, items-center 부모 안에서는 호출부가 self-stretch로 채운다.
 * 아이콘 칸이 없다. 앞에 붙는 표시(로그인 '!' 원)는 호출부가 감싸서 배치한다.
 */
function Alert({
  className,
  tone = "neutral",
  size = "md",
  orientation = "vertical",
  ...props
}: Readonly<ComponentProps<"div"> & VariantProps<typeof alertVariants>>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      {...props}
      data-size={size}
      data-orientation={orientation}
      className={cn(alertVariants({ tone, size, orientation }), className)}
    />
  );
}

// md 제목은 지금 앱 안 상자처럼 본문 굵기 그대로다. 굵은 제목은 로그인·약관 상자(lg)에만 있다
function AlertTitle({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "min-w-0 group-data-[size=lg]/alert:text-body-m-emphasis group-data-[size=lg]/alert:mobile:text-body-s-emphasis",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="alert-description"
      className={cn("min-w-0 text-text-subtle", className)}
      {...props}
    />
  );
}

// 세로 배치에서 동작은 문구보다 8px 아래다(지금 상자의 mt-2). 부품 사이 gap 4px에 위 여백 4px을 더한다
function AlertAction({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="alert-action"
      className={cn(
        "flex group-data-[orientation=horizontal]/alert:shrink-0 group-data-[orientation=vertical]/alert:pt-1",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
