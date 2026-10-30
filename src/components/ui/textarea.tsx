import { cva, type VariantProps } from "class-variance-authority";
import { useImperativeHandle, useLayoutEffect, useRef, type ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Figma 02 Text Field의 Textarea Field 5002:4364. 상태 색과 그 출력 순서는 Input과 같다
// 스크롤 막대 gray/400과 Read Only 글자 gray/800은 Figma가 원시 색에 바로 바인딩해 시맨틱 토큰이 없어 원시 변수를 쓴다
const textareaVariants = cva(
  // 오른쪽 28 = Text 래퍼 14 + 스크롤 레인 14(막대 4×24는 얇은 기본 스크롤바로 대신한다)
  "block w-full min-w-0 resize-none overflow-y-auto rounded-md border border-border bg-fill-subtle py-3 pr-7 pl-3.5 text-body-m-regular text-text transition-colors [scrollbar-color:var(--gray-400)_transparent] [scrollbar-width:thin] placeholder:text-text-subtle focus:border-primary focus:outline-hidden read-only:bg-fill read-only:text-[var(--gray-800)] disabled:cursor-not-allowed disabled:bg-fill disabled:text-text-disabled disabled:placeholder:text-text-disabled aria-invalid:border-status-negative",
  {
    variants: {
      sizing: {
        // rows와 무관하게 96 고정, 넘치면 스크롤한다(rows로 높이를 정하면 rows=3이 98px이 된다)
        fixed: "h-24",
        // 내용 따라 3줄(98)에서 5줄(146)까지 자라고 넘치면 스크롤한다. 줄 높이 24 × 줄 수 + 위아래 여백 24 + 테두리 2
        content: "min-h-[98px] max-h-[146px]",
      },
    },
    defaultVariants: { sizing: "fixed" },
  },
);

function Textarea({
  className,
  sizing = "fixed",
  ref,
  value,
  ...props
}: Readonly<ComponentProps<"textarea"> & VariantProps<typeof textareaVariants>>) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement, []);

  // content는 값이 바뀔 때마다 높이를 내용에 맞추고 min·max가 3~5줄로 자른다. 줄어들 때도 맞게 auto로 푼 뒤 잰다
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (sizing !== "content" || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [sizing, value]);

  return (
    <textarea
      ref={innerRef}
      data-slot="textarea"
      value={value}
      className={cn(textareaVariants({ sizing }), className)}
      {...props}
    />
  );
}

export { Textarea };
