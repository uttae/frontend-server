import type { ComponentProps } from "react";

import { UserIcon } from "@/assets/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Props = Pick<ComponentProps<typeof Avatar>, "size" | "shape" | "tone" | "ring" | "className" | "style"> & {
  user: { nickname: string; profileImageUrl: string | null };
};

export function UserAvatar({ user, tone, ...avatarProps }: Readonly<Props>) {
  const src = user.profileImageUrl?.trim();

  return (
    <Avatar aria-hidden tone={tone} {...avatarProps}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback>{tone === "icon" ? <UserIcon /> : Array.from(user.nickname.trim())[0]}</AvatarFallback>
    </Avatar>
  );
}
