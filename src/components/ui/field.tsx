import type { ComponentProps } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Figma 02 Text Field: Text Field Base 5002:4415·Textarea Field Base 5002:4424(Header·입력·Footer 세로 간격 4), Header 5002:4449, Footer 5002:4440
// 오류 라벨·보조 문구·카운트의 status/negative/strong(#c10000)은 시맨틱 토큰이 없어 원시 변수 --red-800을 쓴다

// shadcn의 role="group"은 두지 않는다. 입력 하나와 라벨을 묶는 배치용 div라(Base UI Field.Root도 role 없는 div) 이름 없는 그룹만 한 겹 더 읽힌다
function Field({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="field"
      className={cn("group/field flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  );
}

// Label 프레임 Fill + Suffix Slot Hug, 간격 30
function FieldHeader({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="field-header"
      className={cn(
        "flex items-center gap-7.5 *:data-[slot=field-label]:min-w-0 *:data-[slot=field-label]:flex-1",
        className,
      )}
      {...props}
    />
  );
}

function FieldLabel({ className, ...props }: Readonly<ComponentProps<typeof Label>>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        // 비활성·읽기 전용은 입력(input·textarea)에서만 읽는다. 같은 Field 안 버튼이 비활성이어도 라벨은 그대로다
        // 겹치면 오류 > 비활성 > 읽기 전용: 저장 중 비활성이 돼도 오류 표시를 남긴다
        "group-has-[[aria-invalid=true]]/field:text-[var(--red-800)] group-has-[:is(input,textarea):disabled:not([aria-invalid=true])]/field:text-text-disabled group-has-[:is(input,textarea)[readonly]:enabled:not([aria-invalid=true])]/field:text-text-subtle",
        className,
      )}
      {...props}
    />
  );
}

function FieldSuffix({ className, ...props }: Readonly<ComponentProps<"span">>) {
  return (
    <span
      data-slot="field-suffix"
      className={cn("shrink-0 text-caption-s-regular text-text-subtle", className)}
      {...props}
    />
  );
}

function FieldFooter({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return <div data-slot="field-footer" className={cn("flex items-center", className)} {...props} />;
}

function FieldDescription({ className, ...props }: Readonly<ComponentProps<"p">>) {
  return (
    <p
      data-slot="field-description"
      className={cn("min-w-0 text-caption-s-regular text-text-subtle", className)}
      {...props}
    />
  );
}

// Figma Error 상태의 Helper Text
function FieldError({ className, children, ...props }: Readonly<ComponentProps<"p">>) {
  if (!children) return null;
  return (
    <p
      role="alert"
      data-slot="field-error"
      className={cn("min-w-0 text-caption-s-regular text-[var(--red-800)]", className)}
      {...props}
    >
      {children}
    </p>
  );
}

// Helper Text 없이 카운트만 있어도 오른쪽 끝에 붙도록 Footer의 space-between 대신 ms-auto로 민다
function FieldCount({ className, ...props }: Readonly<ComponentProps<"span">>) {
  return (
    <span
      data-slot="field-count"
      className={cn(
        "ms-auto shrink-0 text-caption-s-regular text-text-subtle group-has-[[aria-invalid=true]]/field:text-[var(--red-800)]",
        className,
      )}
      {...props}
    />
  );
}

export {
  Field,
  FieldHeader,
  FieldLabel,
  FieldSuffix,
  FieldFooter,
  FieldDescription,
  FieldError,
  FieldCount,
};
