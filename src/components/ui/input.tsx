import { Input as InputPrimitive } from "@base-ui/react/input";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Figma 02 Text Field 5002:4382의 Field 프레임. Type은 DOM 상태로 그린다: Focused=:focus, Error Filled·Error Focused=aria-invalid, Disabled=:disabled, Read Only=:read-only
// Read Only 글자는 Figma가 원시 gray/800에 바로 바인딩해 시맨틱 토큰이 없어 원시 변수를 쓴다
// :read-only는 비활성 입력에도 걸리지만 Tailwind가 disabled:를 뒤에 출력해 비활성 색이 이긴다. aria-invalid:도 focus: 뒤라 포커스 중에도 오류 테두리가 남는다
function Input({ className, type, ...props }: Readonly<ComponentProps<"input">>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // 세로 padding 12 대신 min-h-12와 입력의 기본 세로 가운데 정렬로 48px을 맞춘다(CSS 테두리는 padding 밖이라 py-3이면 50px). 오른쪽 14 = padding 10 + Text 프레임 4
        "min-h-12 w-full min-w-0 rounded-md border border-border bg-fill-subtle px-3.5 text-body-m-regular text-text transition-colors placeholder:text-text-subtle focus:border-primary focus:outline-hidden read-only:bg-fill read-only:text-[var(--gray-800)] disabled:cursor-not-allowed disabled:bg-fill disabled:text-text-disabled disabled:placeholder:text-text-disabled aria-invalid:border-status-negative",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
