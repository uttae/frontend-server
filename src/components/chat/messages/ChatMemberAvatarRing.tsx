"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";

export function ChatMemberAvatarRing({
  avatarUrl,
  alt,
  senderNotInRoom,
  chromeAvatarClassName,
  reduceMotion,
}: {
  avatarUrl?: string;
  alt: string;
  /** 방을 나간 타인 — 사진이 있어도 기본 프로필 플레이스홀더 오버레이 */
  senderNotInRoom?: boolean;
  chromeAvatarClassName: string;
  reduceMotion: boolean | null;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  const [previousAvatarUrl, setPreviousAvatarUrl] = useState(avatarUrl);
  if (previousAvatarUrl !== avatarUrl) {
    setPreviousAvatarUrl(avatarUrl);
    setImgFailed(false);
  }

  const showImage = Boolean(avatarUrl?.trim()) && !imgFailed;
  const showPlaceholderOverlay =
    Boolean(senderNotInRoom) || !showImage;

  return (
    <div className={cn(chromeAvatarClassName, "relative bg-light-gray")}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- 멤버 프로필 URL 가변
        <img
          src={avatarUrl}
          alt={alt}
          className={cn(
            "h-full w-full object-cover",
            !reduceMotion && "transition-opacity duration-150 ease-out",
          )}
          onError={() => setImgFailed(true)}
        />
      ) : null}
      {showPlaceholderOverlay ? (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[inherit] bg-[#ebebeb]"
          aria-hidden
        >
          <User
            className="h-[58%] w-[58%] text-[#bfbfbf]"
            strokeWidth={1.35}
          />
        </span>
      ) : null}
    </div>
  );
}
