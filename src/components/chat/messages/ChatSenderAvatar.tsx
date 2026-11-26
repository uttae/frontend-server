import type { ComponentProps } from "react";

import { UserAvatar } from "@/components/user/UserAvatar";
import type { ChatMessage } from "@/types/chat";

type Props = Pick<ComponentProps<typeof UserAvatar>, "size" | "ring"> & {
  message: Pick<ChatMessage, "sender" | "avatar" | "senderNotInRoom">;
};

export function ChatSenderAvatar({ message, ...avatarProps }: Readonly<Props>) {
  return (
    <UserAvatar
      user={{
        nickname: message.sender ?? "",
        profileImageUrl: message.senderNotInRoom ? null : (message.avatar ?? null),
      }}
      shape="rounded"
      tone="icon"
      {...avatarProps}
    />
  );
}
