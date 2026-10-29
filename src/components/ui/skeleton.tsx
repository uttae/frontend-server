import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Figma DS에 Skeleton이 없어 지금 화면들이 쓰는 스켈레톤 블록 모양을 그대로 옮긴다.
const skeletonVariants = cva(
  // 글줄 모서리는 지금 쓰는 bare `rounded`(Tailwind v4에서 지원 중단된 0.25rem)를 rem 그대로 옮긴다.
  // 기본 글자 크기에서 Figma radius/sm 4px(6034:29246)이고, 맞는 토큰이 없다(rounded-sm = 6px).
  // block: render={<span />}로 그려도 h-*·w-*가 먹게 한다(인라인 자리는 className에 inline-block)
  "block animate-pulse rounded-[0.25rem] motion-reduce:animate-none",
  {
    variants: {
      tone: {
        strong: "bg-fill-strong",
        // strong보다 옅은 톤이라는 뜻으로 fill/default다. bg-fill-subtle이 아니다.
        subtle: "bg-fill",
      },
    },
    defaultVariants: { tone: "strong" },
  },
);

/**
 * 로딩 안내(output·aria-busy)는 감싸는 영역이 맡아 블록은 aria-hidden이다.
 * 바깥 className은 크기·배치와 모서리만 바꾼다. 모서리는 대신하는 요소(버튼·카드·사진)를 따라야 해서
 * 예외로 둔다(Figma Radius 6057:472: 기존 컴포넌트에 명시된 Radius 우선). 색은 tone으로만 바꾼다.
 * div를 둘 수 없는 `<output>`·`<span>` 안에서는 render={<span />}를 쓴다. render 요소에 준 className은
 * cn을 거치지 않고 이어 붙어 기본 클래스와 겹쳐도 정리되지 않으므로, 클래스는 Skeleton의 className으로 넘긴다.
 */
function Skeleton({
  className,
  tone,
  render,
  ...props
}: Readonly<useRender.ComponentProps<"div"> & VariantProps<typeof skeletonVariants>>) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      { "aria-hidden": true, className: cn(skeletonVariants({ tone }), className) },
      props,
    ),
    state: { slot: "skeleton" },
  });
}

export { Skeleton };
