import type { ChatMessage } from "@/types/chat";

export function isChatHistoryPrependSnapshot(
  prevCount: number,
  prevFirstId: string | undefined,
  nextCount: number,
  nextFirstId: string | undefined,
): boolean {
  return nextCount > prevCount && prevCount > 0 && nextFirstId !== undefined && nextFirstId !== prevFirstId;
}

export function isChatHistoryAppendSnapshot(
  prevCount: number,
  prevFirstId: string | undefined,
  nextCount: number,
  nextFirstId: string | undefined,
): boolean {
  return nextCount > prevCount && prevCount > 0 && nextFirstId !== undefined && nextFirstId === prevFirstId;
}

export function groupConsecutiveMessages(
  messages: ChatMessage[],
  splitAfterMessageId?: string | null,
): ChatMessage[][] {
  const groups: ChatMessage[][] = [];
  let current: ChatMessage[] = [];

  for (const msg of messages) {
    if (msg.type === "place") {
      if (current.length) {
        groups.push(current);
        current = [];
      }
      groups.push([msg]);
      continue;
    }

    if (msg.type === "system") {
      if (current.length) {
        groups.push(current);
        current = [];
      }
      const tail = groups[groups.length - 1];
      if (tail && tail[0]?.type === "system") {
        tail.push(msg);
      } else {
        groups.push([msg]);
      }
      continue;
    }

    const prev = current[current.length - 1];
    const sameSenderGroup =
      prev &&
      prev.type === msg.type &&
      ((msg.type === "mine" || msg.type === "other") && prev.senderUserId != null && msg.senderUserId != null
        ? prev.senderUserId === msg.senderUserId
        : prev.sender === msg.sender);

    if (sameSenderGroup) {
      current.push(msg);
    } else {
      if (current.length) groups.push(current);
      current = [msg];
    }
  }
  if (current.length) groups.push(current);

  if (!splitAfterMessageId) return groups;

  return groups.flatMap((group) => {
    const boundaryIndex = group.findIndex((msg) => msg.id === splitAfterMessageId);
    if (boundaryIndex < 0 || boundaryIndex === group.length - 1) return [group];
    return [group.slice(0, boundaryIndex + 1), group.slice(boundaryIndex + 1)];
  });
}
