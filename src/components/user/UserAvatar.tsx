"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  user: { nickname: string; profileImageUrl: string | null };
  size?: number;
};

/** 프로필 이미지가 없거나 로드에 실패하면 닉네임 첫 글자로 대체 */
export function UserAvatar({ user, size = 32 }: Props) {
  const [failed, setFailed] = useState(false);
  const initial = user.nickname.charAt(0);
  const showImage = Boolean(user.profileImageUrl) && !failed;

  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary"
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
          className="font-semibold text-white"
          style={{ fontSize: Math.round(size * 0.44) }}
        >
          {initial}
        </span>
      )}
    </span>
  );
}
