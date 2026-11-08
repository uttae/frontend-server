import type { ComponentProps } from "react";

import { UserAvatar } from "@/components/user/UserAvatar";
import type { ChatMessage } from "@/types/chat";

type Props = Pick<ComponentProps<typeof UserAvatar>, "size" | "ring"> & {
  message: Pick<ChatMessage, "sender" | "avatar" | "senderNotInRoom">;
};

/** 채팅 보낸 사람의 사진 자리. 방을 나간 사람은 사진이 있어도 사람 아이콘을 보인다 */
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
