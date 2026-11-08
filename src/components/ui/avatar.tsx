import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Figma DS에 Avatar 컴포넌트가 없어 지금 화면들의 아바타 모양을 옮긴다. Figma 근거는 Header Profile(5219:10776)의
// 36px·fill/strong 원뿐이라 이것을 기본값으로 둔다. 크기는 글자 설정을 따라 커지지 않게 px로 둔다(원칙 3-2).
// 대체 글자는 화면별 지금 크기·굵기(24 가계부, 28 헤더 미리보기, 32 리뷰, 36 구성원, 56 내 정보)에 가장 가까운 토큰이고,
// 글자를 쓰는 곳이 없는 40은 크기의 44%(18px)다. 대체 아이콘은 지금 채팅 아바타처럼 크기의 58%에 가장 가까운 Figma 아이콘 크기다.
const avatarVariants = cva("relative flex shrink-0 select-none items-center justify-center overflow-hidden", {
  variants: {
    size: {
      24: "size-[24px] text-body-xs-regular [&_svg]:size-[12px]",
      28: "size-[28px] text-label-xs-regular [&_svg]:size-[16px]",
      32: "size-[32px] text-label-m-regular mobile:text-label-xs-regular [&_svg]:size-[20px]",
      36: "size-[36px] text-label-l-regular [&_svg]:size-[20px]",
      40: "size-[40px] text-label-xl-regular [&_svg]:size-[24px]",
      56: "size-[56px] text-heading-s [&_svg]:size-[32px]",
    },
    shape: {
      circle: "rounded-full",
      rounded: "rounded-xl",
    },
    // 배경은 사진을 받는 동안 보이는 색이기도 하다(AvatarImage가 bg-inherit로 아래의 대체를 가린다)
    tone: {
      primary: "bg-primary-subtle text-primary",
      neutral: "bg-fill text-text-subtle",
      placeholder: "bg-fill-strong text-text-subtle",
      // 채팅 사진 자리 bg-light-gray(#d9d9d9)에 가장 가까운 gray/300은 맞는 semantic이 없어 원시 변수로 쓴다.
      // 대체(사람 아이콘) 칸은 지금처럼 사진 자리보다 밝다
      icon: "bg-[var(--gray-300)] text-icon-disabled *:data-[slot=avatar-fallback]:bg-fill-strong",
      // WOORI(AI) 그림은 흰 바탕에 둔다
      elevate: "bg-fill-elevate",
    },
    ring: {
      none: "",
      online: "ring-2 ring-status-positive",
      // 구성원 카드는 옆에 접속 상태 글자가 있어 옅은 1px 링, 글자가 없는 헤더 미리보기(겹친 묶음)는 굵은 링과 흑백으로 그린다.
      // 묶음 안인지로 나눠 쓰는 쪽은 접속 상태만 정한다
      offline:
        "ring-1 ring-border-subtle in-data-[slot=avatar-group]:ring-2 in-data-[slot=avatar-group]:ring-border in-data-[slot=avatar-group]:grayscale in-data-[slot=avatar-group]:brightness-110 in-data-[slot=avatar-group]:contrast-75",
      // 채팅 목록 아바타. 그림자는 지금 쓰는 shadow-sm에 가장 가까운 Figma shadow/subtle(0 1 4 #1f2229 8%)이다
      subtle: "ring-1 ring-border-subtle shadow-[0_1px_4px_rgba(31,34,41,0.08)]",
      // 채팅 새 메시지 미리보기. 회색 버튼 바탕(background/strong) 위라 윤곽이 border/default다
      default: "ring-1 ring-border",
      // 가계부에서 겹친 아바타 사이를 끊는 안쪽 흰 테두리. 지금 굵기 1.5px에 맞는 토큰이 없다
      cutout: "border-[1.5px] border-fill-elevate",
    },
  },
  // 채팅 새 메시지 미리보기(24·28)는 10px, 채팅 목록(40)은 14px 모서리다
  compoundVariants: [{ shape: "rounded", size: [24, 28], className: "rounded-lg" }],
  defaultVariants: { size: 36, shape: "circle", tone: "placeholder", ring: "none" },
});

// Base UI는 상태 함수 className도 받지만 cn이 버리므로 배치용 문자열만 받는다
type AvatarProps = Omit<AvatarPrimitive.Root.Props, "className"> &
  VariantProps<typeof avatarVariants> & { className?: string };

/** 바깥 className은 배치(겹침 순서·위치)에만 쓴다. 색·크기·모양은 variant로만 바꾼다 */
function Avatar({ className, size, shape, tone, ring, ...props }: Readonly<AvatarProps>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(avatarVariants({ size, shape, tone, ring }), className)}
      {...props}
    />
  );
}

type AvatarImageProps = Omit<AvatarPrimitive.Image.Props, "className" | "keepMounted"> & { className?: string };

function AvatarImage({ className, ...props }: Readonly<AvatarImageProps>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      // 구글 프로필(lh3.googleusercontent.com)은 Referer가 붙으면 로드를 거부한다
      referrerPolicy="no-referrer"
      // 기본 모드는 src가 바뀌면 이전 사진을 내리고 대체를 보인 채 다시 받는다. 지금처럼 새 사진이 올 때까지 이전 사진을 두도록
      // 제자리에서 받는다. 받는 동안은 루트 배경(bg-inherit)으로 아래의 대체를 가리고, 실패하면 숨겨 대체가 바로 보이게 한다
      keepMounted
      className={cn("absolute inset-0 size-full bg-inherit object-cover data-error:hidden", className)}
      {...props}
    />
  );
}

// delay를 주면 실패한 사진의 대체도 그만큼 늦게 보인다. 받는 동안은 AvatarImage가 대체를 덮어 delay가 필요 없다
type AvatarFallbackProps = Omit<AvatarPrimitive.Fallback.Props, "className" | "delay"> & { className?: string };

function AvatarFallback({ className, ...props }: Readonly<AvatarFallbackProps>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn("flex size-full items-center justify-center", className)}
      {...props}
    />
  );
}

/** 버튼 안에도 두도록 span으로 그린다. 앞사람이 위에 오는 겹침 순서는 쓰는 쪽이 자식 className의 z로 정한다 */
function AvatarGroup({ className, ...props }: Readonly<ComponentProps<"span">>) {
  return (
    <span
      data-slot="avatar-group"
      className={cn("isolate flex items-center *:not-first:-ml-1.5", className)}
      {...props}
    />
  );
}

/** 헤더 구성원 미리보기의 +N. 쓰는 곳이 28px 묶음뿐이라 크기를 고정한다 */
function AvatarGroupCount({ className, ...props }: Readonly<ComponentProps<"span">>) {
  return (
    <span
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-[28px] shrink-0 items-center justify-center rounded-full bg-fill text-label-m-regular text-text-subtle",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage };
