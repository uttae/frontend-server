"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva } from "class-variance-authority";
import { createContext, useContext, useMemo } from "react";

import { cn } from "@/lib/utils";

// Figma 11 Tabs(5138:2632): Tabs Line 5139:2996, Tabs Chip 5139:2997, Tab Item 5139:2681.
// Figma에 세로 탭은 없다. orientation="vertical"은 배치(열 방향)만 바꾸고 모양은 가로와 같다.

// Base UI는 상태 함수 className도 받지만 cn이 버리므로 배치용 문자열만 받는다
type ClassNameProp = { className?: string };

/**
 * 패널(내용 덩어리)을 바꾸는 탭. 같은 목록을 거르는 필터는 Chip(Toggle)을 쓴다.
 * - value·onValueChange(제어) 또는 defaultValue. Base UI 기본 defaultValue는 0이라 문자열 값을 쓰면 꼭 정한다
 * - 목록과 패널 사이 간격은 화면이 className(gap-*)으로 정한다(Figma 패널 규격 없음)
 */
function Tabs({ className, ...props }: Readonly<Omit<TabsPrimitive.Root.Props, "className"> & ClassNameProp>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col data-[orientation=vertical]:flex-row", className)}
      {...props}
    />
  );
}

type TabsStyle = {
  variant: "line" | "solid" | "outline";
  size: "lg" | "md" | "sm";
  layout: "fill" | "hug";
};

// Line md(44·label/lg)와 Chip md(36·label/md)처럼 같은 size 이름이 종류마다 달라 종류×크기를 cva compoundVariants로 푼다.
// group-data로 쓰면 조합 선택자끼리 명시도가 같아 출력 순서에 기대게 되어, shadcn ToggleGroup처럼 Context로 탭에 넘긴다
const TabsStyleContext = createContext<TabsStyle>({ variant: "line", size: "md", layout: "fill" });

// Figma 컨테이너: Line은 gap 0(5139:2682·2760), Chip은 gap 8(spacing/8, 5139:2838·2916). 배경·밑줄은 없다(막대는 탭마다 그린다).
// 넘치면 Figma가 '별도 스크롤 컨테이너'로 정해(5139:2681 description) 여기서 가로 스크롤을 넣지 않는다. 화면이 overflow-x-auto로 감싼다
const tabsListVariants = cva("flex data-[orientation=vertical]:flex-col", {
  variants: {
    variant: {
      line: "",
      solid: "gap-2",
      outline: "gap-2",
    },
  },
});

type TabsListProps = Omit<TabsPrimitive.List.Props, "className"> &
  ClassNameProp &
  (
    | {
        /** Tabs Line(기본): 주요 콘텐츠 전환 */
        variant?: "line";
        /** md 44(기본) / sm 40 */
        size?: "md" | "sm";
        /** fill(기본): 탭이 폭을 균등 분할 / hug: 탭이 글자 폭 */
        layout?: "fill" | "hug";
      }
    | {
        /** Tabs Chip Type=Solid·Outline: 하위 콘텐츠 전환. 탭은 늘 글자 폭이다 */
        variant: "solid" | "outline";
        /** lg 44(기본) / md 36 */
        size?: "lg" | "md";
        layout?: never;
      }
  );

/**
 * 탭 묶음. 모양(variant·size·layout)은 여기서 한 번 정하고 TabsTrigger가 따른다.
 * activateOnFocus는 Base UI 기본 false다. 화살표는 포커스만 옮기고 Enter·Space·클릭으로 바꾼다(지금 탭들의 클릭 전환과 같다)
 */
function TabsList({ className, variant = "line", size, layout, ...props }: Readonly<TabsListProps>) {
  // Figma 기본: Tabs Line은 Fill·md, Tabs Chip은 lg. Chip 탭은 늘 Hug다
  const resolvedSize = size ?? (variant === "line" ? "md" : "lg");
  const resolvedLayout = variant === "line" ? (layout ?? "fill") : "hug";
  const style = useMemo(
    () => ({ variant, size: resolvedSize, layout: resolvedLayout }),
    [variant, resolvedSize, resolvedLayout],
  );
  return (
    <TabsStyleContext.Provider value={style}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      />
    </TabsStyleContext.Provider>
  );
}

// Tab Item 공통(5139:2681): padding 좌우 24(spacing/24 바인딩 — description의 '16'이 아니라 실제 바인딩), 위아래 0, gap 4, 가운데 정렬.
// 글자색 Enabled text/subtle · Disabled text/disabled. 선택은 aria-selected(Base UI Tab), 비활성은 data-disabled로 그린다.
// data-disabled가 aria-selected보다 뒤에 출력돼 선택+비활성(Figma에 없음)은 비활성 모양이 된다.
// hover·눌림은 Figma에 없어 넣지 않는다. 키보드 포커스 표시도 Figma에 없어 다른 ui 부품과 같은 primary 윤곽선을 쓴다(원칙 3-7)
const tabsTriggerVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 px-6 whitespace-nowrap text-text-subtle transition-[color,background-color,border-color,box-shadow] duration-120 ease-out focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none data-disabled:cursor-not-allowed data-disabled:text-text-disabled",
  {
    variants: {
      variant: {
        // 막대(Indicator 5139:2612·2616)는 탭마다 고정된 2px: 선택 안 됨 border/subtle, 선택 primary/default.
        // Figma 막대는 absolute라 높이를 차지하지 않아 border 대신 안쪽 그림자로 그린다(글자가 44 높이 가운데에 남는다).
        // 붙은 탭끼리 윤곽선이 겹치지 않게 포커스 윤곽선을 안쪽에 둔다
        line: "shadow-[inset_0_-2px_0_var(--color-border-subtle)] focus-visible:-outline-offset-2 aria-selected:text-primary-strong aria-selected:shadow-[inset_0_-2px_0_var(--color-primary-default)] data-disabled:shadow-[inset_0_-2px_0_var(--color-border-subtle)]",
        // Solid(5139:2633·2637·2641): fill/subtle, 선택 primary/default + text/inverse
        solid:
          "rounded-full bg-fill-subtle focus-visible:outline-offset-2 aria-selected:bg-primary aria-selected:text-text-inverse data-disabled:bg-fill-subtle",
        // Outline(5139:2657·2661·2665): border/default 1px 안쪽, 선택 primary/default 테두리 + primary/strong 글자.
        // 선택 배경 Figma primary/subtle은 blue/50인데 코드 primary-subtle은 blue-100이라 원시 변수로 Figma 값에 맞춘다
        outline:
          "rounded-full border border-border bg-fill-subtle focus-visible:outline-offset-2 aria-selected:border-primary aria-selected:bg-[var(--blue-50)] aria-selected:text-primary-strong data-disabled:border-border data-disabled:bg-fill-subtle",
      },
      size: { lg: "", md: "", sm: "" },
      // Line Fill은 탭을 균등 분할한다(5139:2682). flex-1이라도 글자 폭보다 줄지 않는다
      layout: { fill: "flex-1", hug: "" },
    },
    // 높이는 글자가 커지면 늘어나게 min-h로 둔다(원칙 3-2). 선택은 emphasis, 비활성은 regular 글자다
    compoundVariants: [
      // Line md 44 · label/lg (5139:2609·2613·2617)
      {
        variant: "line",
        size: "md",
        className: "min-h-11 text-label-l-regular aria-selected:text-label-l-emphasis data-disabled:text-label-l-regular",
      },
      // Line sm 40 · label/md (5139:2621·2625·2629)
      {
        variant: "line",
        size: "sm",
        className: "min-h-10 text-label-m-regular aria-selected:text-label-m-emphasis data-disabled:text-label-m-regular",
      },
      // Solid·Outline lg 44 · label/lg (5139:2633·2657)
      {
        variant: ["solid", "outline"],
        size: "lg",
        className: "min-h-11 text-label-l-regular aria-selected:text-label-l-emphasis data-disabled:text-label-l-regular",
      },
      // Solid·Outline md 36 · label/md (5139:2645·2669)
      {
        variant: ["solid", "outline"],
        size: "md",
        className: "min-h-9 text-label-m-regular aria-selected:text-label-m-emphasis data-disabled:text-label-m-regular",
      },
    ],
  },
);

/**
 * 탭 하나. value는 TabsContent의 value와 짝이다. disabled면 고를 수 없다(클릭·Enter·Space 무시).
 * 포커스는 받는다: 화살표 이동이 비활성 탭에도 멈춘다(Base UI가 aria-disabled로 그려 WAI-ARIA 탭 패턴대로 건너뛰지 않음).
 * 링크로 그릴 때는 `nativeButton={false} render={<Link href=… />}`(Base UI Tabs "Links").
 * className은 배치만. 모양은 TabsList가 정한다
 */
function TabsTrigger({ className, ...props }: Readonly<Omit<TabsPrimitive.Tab.Props, "className"> & ClassNameProp>) {
  const style = useContext(TabsStyleContext);
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants(style), className)}
      {...props}
    />
  );
}

/**
 * 탭 패널. keepMounted는 Base UI 기본 false라 숨은 패널은 DOM에서 빠진다(안의 state·스크롤 초기화 — 지금 장소 상세 홈·리뷰와 같다).
 * 패널 자체가 포커스를 받을 수 있어(tabIndex 0) 키보드 포커스 표시를 안쪽 윤곽선으로 둔다
 */
function TabsContent({ className, ...props }: Readonly<Omit<TabsPrimitive.Panel.Props, "className"> & ClassNameProp>) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(
        "min-w-0 flex-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
