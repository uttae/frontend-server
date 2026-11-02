import type { ComponentProps } from "react";

import { UserIcon } from "@/assets/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Props = Pick<ComponentProps<typeof Avatar>, "size" | "shape" | "tone" | "ring" | "className" | "style"> & {
  user: { nickname: string; profileImageUrl: string | null };
};

/**
 * 프로필 사진이 없거나 로드에 실패하면 닉네임 첫 글자로, tone="icon"(채팅·가계부 사진 자리)이면 사람 아이콘으로 대체.
 * 쓰는 곳마다 이름이 옆에 보이거나 버튼 aria-label이 있어 장식으로 숨긴다
 */
export function UserAvatar({ user, tone, ...avatarProps }: Readonly<Props>) {
  const src = user.profileImageUrl?.trim();

  return (
    <Avatar aria-hidden tone={tone} {...avatarProps}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback>{tone === "icon" ? <UserIcon /> : Array.from(user.nickname.trim())[0]}</AvatarFallback>
    </Avatar>
  );
}
