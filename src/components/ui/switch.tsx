import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Figma에 Switch가 없어 지금 화면의 두 스위치 모양을 옮긴다. md는 쿠키 설정(AnalyticsConsentSettings), sm은 일정의 '지도에 경로 표시'(PlanDaySection)다.
// md는 루트가 지금 버튼과 같은 56×44 누르는 영역이고 그 안에 트랙이 있다. sm은 루트가 트랙 크기이고 누르는 영역은 감싸는 label 행이 맡는다
const switchVariants = cva(
  "group/switch inline-flex shrink-0 cursor-pointer items-center focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed",
  {
    variants: {
      size: {
        md: "min-h-11 rounded-lg p-1 focus-visible:outline-offset-4",
        // 지금은 윤곽선을 행 전체에 간격 없이 그린다. 트랙에 바로 붙이면 켜진 트랙과 같은 primary라 보이지 않아 띄운다
        sm: "rounded-full focus-visible:outline-offset-2",
      },
    },
    defaultVariants: { size: "md" },
  },
);

// 꺼짐 색은 지금 쓰는 Tailwind 기본 팔레트·레거시 별칭(사용 금지)을 가까운 우때 값으로 바꾼 것이다.
// md: neutral-400(#a1a1a1) → RGB 거리가 가장 가깝고 흰 배경 대비 3:1을 넘는 gray/600. 같은 값의 icon-subtle은 아이콘 색이라 원시 변수를 쓴다.
// sm: 레거시 gray-300(#e2e8f0) → fill-strong
const switchTrackVariants = cva(
  "flex items-center rounded-full transition-colors group-aria-checked/switch:bg-primary motion-reduce:transition-none",
  {
    variants: {
      size: {
        md: "h-7 w-12 bg-[var(--gray-600)] p-1",
        sm: "h-5 w-9 bg-fill-strong p-0.5",
      },
    },
    defaultVariants: { size: "md" },
  },
);

// 그림자는 Figma 명세가 없어 지금 쓰는 Tailwind shadow-sm 값을 그대로 옮긴다
const switchThumbVariants = cva(
  "rounded-full bg-fill-elevate shadow-[0_1px_3px_0_rgb(0_0_0/0.1),0_1px_2px_-1px_rgb(0_0_0/0.1)] transition-transform motion-reduce:transition-none",
  {
    variants: {
      size: {
        md: "size-5 data-checked:translate-x-5",
        sm: "size-4 data-checked:translate-x-4",
      },
    },
    defaultVariants: { size: "md" },
  },
);

type SwitchProps = Omit<SwitchPrimitive.Root.Props, "className" | "nativeButton" | "render"> &
  VariantProps<typeof switchVariants> & {
    // Base UI는 상태 함수 className도 받지만 cn이 버리므로 배치용 문자열만 받는다
    className?: string;
  };

/** 비활성 모양은 지금 화면에 없어 커서만 바꾼다 */
function Switch({ className, size, ...props }: Readonly<SwitchProps>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      // 지금 스위치처럼 폼을 제출하지 않는 <button type="button">으로 그린다. Base UI 기본은 span이다
      nativeButton
      render={<button type="button" />}
      className={cn(switchVariants({ size }), className)}
      {...props}
    >
      <span data-slot="switch-track" className={switchTrackVariants({ size })}>
        <SwitchPrimitive.Thumb data-slot="switch-thumb" className={switchThumbVariants({ size })} />
      </span>
    </SwitchPrimitive.Root>
  );
}

export { Switch };
