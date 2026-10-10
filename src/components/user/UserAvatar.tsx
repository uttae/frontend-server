"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

type Props = {
  user: { nickname: string; profileImageUrl: string | null };
  size?: number;
  className?: string;
  /** 이니셜 대체 표시 글자 스타일 */
  initialClassName?: string;
};

/** 프로필 이미지가 없거나 로드에 실패하면 닉네임 첫 글자로 대체 */
export function UserAvatar({ user, size = 32, className, initialClassName = "font-semibold text-white" }: Readonly<Props>) {
  const [failed, setFailed] = useState(false);
  const initial = user.nickname.charAt(0);
  const showImage = Boolean(user.profileImageUrl) && !failed;

  return (
    <span
      className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full", className)}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <Image
          src={user.profileImageUrl as string}
          alt={user.nickname}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={initialClassName}
          style={{ fontSize: Math.round(size * 0.44) }}
        >
          {initial}
        </span>
      )}
    </span>
  );
}
