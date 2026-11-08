import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Figma 02 Text Field의 Textarea Field 5002:4364. 상태 색과 그 출력 순서는 Input과 같다
// 스크롤 막대 gray/400과 Read Only 글자 gray/800은 Figma가 원시 색에 바로 바인딩해 시맨틱 토큰이 없어 원시 변수를 쓴다
function Textarea({ className, ...props }: Readonly<ComponentProps<"textarea">>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // 시작 높이는 rows와 무관하게 96(rows로 정하면 rows=3이 98px이 된다), 넘치면 스크롤한다. 오른쪽 28 = Text 래퍼 14 + 스크롤 레인 14(막대 4×24는 얇은 기본 스크롤바로 대신한다)
        // 손으로 세로만 늘릴 수 있고 96보다 줄지 않으며 8줄(줄 24 × 8 + 위아래 여백 24 + 테두리 2 = 218)까지 늘어난다.
        // Figma는 자동 확장·최대 높이를 정하지 않았다(Textarea Field 5002:4364 설명). 터치 기기는 손잡이가 없어 96 그대로다
        "block h-24 max-h-[218px] min-h-24 w-full min-w-0 resize-y overflow-y-auto rounded-md border border-border bg-fill-subtle py-3 pr-7 pl-3.5 text-body-m-regular text-text transition-colors [scrollbar-color:var(--gray-400)_transparent] [scrollbar-width:thin] placeholder:text-text-subtle focus:border-primary focus:outline-hidden read-only:bg-fill read-only:text-[var(--gray-800)] disabled:cursor-not-allowed disabled:bg-fill disabled:text-text-disabled disabled:placeholder:text-text-disabled aria-invalid:border-status-negative",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
