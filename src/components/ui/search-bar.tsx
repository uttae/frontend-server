import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { ChevronLeftIcon, CloseIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

// Figma 02 Text Field의 Search Bar(5002:4377): 48px, padding L14 R10, gap 8, radius 8, 바탕 fill/subtle.
// 테두리는 Default border/default → Focused primary/default → 값이 있고 포커스가 없으면(Filled) primary/strong.
// Filled는 입력의 :placeholder-shown으로 읽어서 SearchBarInput은 placeholder를 꼭 받는다
const searchBarVariants = cva(
  "flex h-12 w-full min-w-0 items-center gap-2 border border-border bg-fill-subtle pl-3.5 pr-2.5 transition-colors focus-within:border-primary has-[input:disabled]:bg-fill [&:has(input:not(:placeholder-shown)):not(:focus-within)]:border-primary-strong",
  {
    variants: {
      // pill은 모바일 검색 전용 화면(지도 검색·장소 추가 검색)의 기존 알약 모양이다. Figma Search Bar에는 없다
      shape: {
        rounded: "rounded-md",
        pill: "rounded-full",
      },
    },
    defaultVariants: { shape: "rounded" },
  },
);

function SearchBar({
  className,
  shape,
  ...props
}: Readonly<ComponentProps<"div"> & VariantProps<typeof searchBarVariants>>) {
  return (
    <div
      data-slot="search-bar"
      className={cn(searchBarVariants({ shape }), className)}
      {...props}
    />
  );
}

// Leading Icon 20px, icon/subtle. 아이콘(@/assets/icons)을 size={20}으로 넣는다
function SearchBarIcon({ className, ...props }: Readonly<ComponentProps<"span">>) {
  return (
    <span
      aria-hidden
      data-slot="search-bar-icon"
      className={cn("flex shrink-0 text-icon-subtle", className)}
      {...props}
    />
  );
}

// 모바일 검색 전용 화면의 뒤로가기. Figma Search Bar에는 없어 Leading Icon 자리(20px)에 둔다.
// 누르는 영역은 지우기와 같은 32px × 칸 높이이고, 음수 margin으로 줄 안에서는 아이콘 폭 20px만 차지한다(왼쪽 여백 14·간격 8 안에서 끝난다)
function SearchBarBack({ className, ...props }: Readonly<ComponentProps<"button">>) {
  return (
    <button
      type="button"
      data-slot="search-bar-back"
      className={cn(
        "-mx-1.5 grid w-8 shrink-0 cursor-pointer place-items-center self-stretch text-icon-subtle focus-visible:outline-2 focus-visible:outline-primary",
        className,
      )}
      {...props}
    >
      <ChevronLeftIcon size={20} />
    </button>
  );
}

// Figma Text 프레임 오른쪽 4px, 입력 글자 text/default, 플레이스홀더 text/subtle
function SearchBarInput({
  className,
  placeholder,
  ...props
}: Readonly<ComponentProps<"input"> & { placeholder: string }>) {
  return (
    <input
      data-slot="search-bar-input"
      placeholder={placeholder}
      className={cn(
        "min-w-0 flex-1 self-stretch bg-transparent pr-1 text-body-m-regular text-text outline-none placeholder:text-text-subtle disabled:cursor-not-allowed disabled:text-text-disabled [&::-webkit-search-cancel-button]:hidden",
        className,
      )}
      {...props}
    />
  );
}

// Trailing Icon 영역 32×48, close 20px. 언제 보일지는 호출부가 정한다(값이 있을 때 등)
function SearchBarClear({ className, ...props }: Readonly<ComponentProps<"button">>) {
  return (
    <button
      type="button"
      data-slot="search-bar-clear"
      className={cn(
        "grid w-8 shrink-0 cursor-pointer place-items-center self-stretch text-icon-subtle focus-visible:outline-2 focus-visible:outline-primary",
        className,
      )}
      {...props}
    >
      <CloseIcon size={20} />
    </button>
  );
}

export { SearchBar, SearchBarBack, SearchBarIcon, SearchBarInput, SearchBarClear };
