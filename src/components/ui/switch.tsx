import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// sm은 일정의 '경로 보기'(PlanDaySection)로 Figma Toggle Switch(워크스페이스 GUI 6663:5220)를 따른다.
// md는 쿠키 설정(AnalyticsConsentSettings)뿐이고 Figma에 없어 지금 화면 모양을 옮긴다.
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

// md 꺼짐 색: 지금 쓰던 Tailwind neutral-400(#a1a1a1)에 RGB 거리가 가장 가깝고 흰 배경 대비 3:1을 넘는 gray/600. 같은 값의 icon-subtle은 아이콘 색이라 원시 변수를 쓴다.
// sm 색: Figma 토글은 디자인 시스템이 아닌 라이브러리의 Sementic 변수(icon/secondary #0099ff·icon/disabled·icon/inverse)를 쓴다.
// 디자인 시스템 Semantic에는 icon/secondary가 없고 secondary는 라임이라, 같은 역할의 primary·icon-disabled·icon-inverse로 옮긴다
const switchTrackVariants = cva(
  "flex items-center rounded-full transition-colors group-aria-checked/switch:bg-primary motion-reduce:transition-none",
  {
    variants: {
      size: {
        md: "h-7 w-12 bg-[var(--gray-600)] p-1",
        sm: "h-5 w-10 bg-icon-disabled p-0.5",
      },
    },
    defaultVariants: { size: "md" },
  },
);

const switchThumbVariants = cva(
  "rounded-full transition-transform motion-reduce:transition-none",
  {
    variants: {
      size: {
        // 그림자는 Figma 명세가 없어 지금 쓰는 Tailwind shadow-sm 값을 그대로 옮긴다
        md: "size-5 bg-fill-elevate shadow-[0_1px_3px_0_rgb(0_0_0/0.1),0_1px_2px_-1px_rgb(0_0_0/0.1)] data-checked:translate-x-5",
        sm: "size-4 bg-icon-inverse data-checked:translate-x-5",
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
