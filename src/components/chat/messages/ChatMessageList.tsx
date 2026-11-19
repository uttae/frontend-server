"use client";

import { Spinner } from "@/components/ui/spinner";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import type { ChatMessage } from "@/types/chat";
import { cn } from "@/lib/utils";
import type { ChatScrollAnchorRequest, ReadDividerPlacement } from "@/lib/chat/readBoundary";
import {
  applyScrollAnchor,
  CHAT_NEAR_BOTTOM_PX,
  scrollReadBoundaryToBottom,
  scrollRootToBottomInstant,
  setIsAtBottomIfChanged,
} from "@/lib/chat/chatMessageListScroll";
import {
  groupConsecutiveMessages,
  isChatHistoryAppendSnapshot,
  isChatHistoryPrependSnapshot,
} from "../chat-message-utils";
import { OtherMessageGroup, MyMessageGroup, SystemMessage, AiMessageGroup } from "./ChatMessageGroup";
import { PlaceShareCard } from "./PlaceShareCard";
import { JumpToBottomButton } from "./JumpToBottomButton";
import { NewMessagePreviewButton } from "./NewMessagePreviewButton";
import { ChatReadDivider } from "./ChatReadDivider";

function isPreviewMessage(message: ChatMessage): boolean {
  return message.type === "other" || message.type === "mine" || message.type === "place";
}

function syncFollowTailFromScrollRoot(root: HTMLDivElement, followTailRef: MutableRefObject<boolean>) {
  const dist = root.scrollHeight - root.scrollTop - root.clientHeight;
  followTailRef.current = dist < CHAT_NEAR_BOTTOM_PX;
}

export function ChatMessageList({
  messages,
  isMinimized = false,
  onCancelAiRequest,
  onLoadOlder,
  hasMoreOlder = false,
  isLoadingOlder = false,
  onLoadNewer,
  hasMoreNewer = false,
  isLoadingNewer = false,
  onJumpToLatest,
  readMarkerMessageId,
  readDividerPlacement,
  scrollToAnchor,
  onAtBottom,
}: {
  messages: ChatMessage[];
  isMinimized?: boolean;
  onCancelAiRequest?: (requestMessageId: string) => void;
  onLoadOlder?: () => void;
  hasMoreOlder?: boolean;
  isLoadingOlder?: boolean;
  onLoadNewer?: () => void;
  hasMoreNewer?: boolean;
  isLoadingNewer?: boolean;
  onJumpToLatest?: () => void;
  readMarkerMessageId?: string | null;
  readDividerPlacement?: ReadDividerPlacement | null;
  scrollToAnchor?: ChatScrollAnchorRequest | null;
  onAtBottom?: () => void;
}) {
  const groups = groupConsecutiveMessages(messages, readDividerPlacement?.afterMessageId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const prevFirstIdRef = useRef<string | undefined>(undefined);
  const scrollPreserveRef = useRef({ sh: 0, st: 0 });
  const didInitialScrollRef = useRef(false);
  const lastScrollAnchorKeyRef = useRef<number | null>(null);
  const followTailRef = useRef(true);
  const distFromBottomRef = useRef(0);
  const restoringReadBoundaryRef = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [smoothJumpToBottom, setSmoothJumpToBottom] = useState(false);
  const [newMessagePreview, setNewMessagePreview] = useState<ChatMessage | null>(null);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  const scrollToBottomSmooth = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  const handleJumpClick = useCallback(() => {
    setNewMessagePreview(null);
    restoringReadBoundaryRef.current = false;
    followTailRef.current = true;
    if (hasMoreNewer && onJumpToLatest) {
      onJumpToLatest();
    } else {
      setSmoothJumpToBottom(true);
      scrollToBottomSmooth();
    }
  }, [hasMoreNewer, onJumpToLatest, scrollToBottomSmooth]);

  const scrollToMessage = useCallback((messageId: string) => {
    const root = scrollRootRef.current;
    if (!root) return;
    const el = root.querySelector(`[data-chat-anchor="${CSS.escape(messageId)}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const handleScroll = useCallback(() => {
    const root = scrollRootRef.current;
    if (!root) return;
    scrollPreserveRef.current = {
      sh: root.scrollHeight,
      st: root.scrollTop,
    };
    const dist = root.scrollHeight - root.scrollTop - root.clientHeight;
    distFromBottomRef.current = dist;
    if (restoringReadBoundaryRef.current) {
      followTailRef.current = false;
      setIsAtBottomIfChanged(setIsAtBottom, false);
      return;
    }
    const near = dist < CHAT_NEAR_BOTTOM_PX;
    followTailRef.current = near;
    setIsAtBottomIfChanged(setIsAtBottom, near);
    if (near) {
      setNewMessagePreview(null);
      onAtBottom?.();
    }
  }, [onAtBottom]);

  useLayoutEffect(() => {
    const root = scrollRootRef.current;
    const bottom = bottomRef.current;
    if (!root) return;

    const prevSh = scrollPreserveRef.current.sh;
    const prevSt = scrollPreserveRef.current.st;

    const prevCount = prevCountRef.current;
    const prevFirst = prevFirstIdRef.current;

    const firstId = messages[0]?.id;
    const count = messages.length;

    if (prevCount > 0 && count === 0) {
      didInitialScrollRef.current = false;
    }

    const prepended = isChatHistoryPrependSnapshot(prevCount, prevFirst, count, firstId);
    const appended = isChatHistoryAppendSnapshot(prevCount, prevFirst, count, firstId);
    const hasFrozenDivider =
      readMarkerMessageId != null &&
      (readDividerPlacement?.afterMessageId != null || readDividerPlacement?.beforeFirst === true);

    let didTailScroll = false;

    if (prepended && prevSh > 0) {
      const newSh = root.scrollHeight;
      root.scrollTop = newSh - prevSh + prevSt;
    } else if (appended && hasFrozenDivider && !followTailRef.current) {
      root.scrollTop = prevSt;
    } else if (appended && followTailRef.current) {
      scrollRootToBottomInstant(root);
      didTailScroll = true;
    } else if (prevCount === 0 && count > 0 && !didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      if (!scrollToAnchor) {
        bottom?.scrollIntoView({ behavior: "auto", block: "end" });
        syncFollowTailFromScrollRoot(root, followTailRef);
      }
    } else if (followTailRef.current && !prepended && !appended && count > 0 && root.scrollHeight > prevSh) {
      scrollRootToBottomInstant(root);
      didTailScroll = true;
    }

    prevCountRef.current = count;
    prevFirstIdRef.current = firstId;
    scrollPreserveRef.current = {
      sh: root.scrollHeight,
      st: root.scrollTop,
    };
    const distAfter = root.scrollHeight - root.scrollTop - root.clientHeight;
    const nearAfter = distAfter < CHAT_NEAR_BOTTOM_PX;
    setIsAtBottomIfChanged(setIsAtBottom, nearAfter);

    const newest = messages[count - 1];
    if (appended && !nearAfter && newest && isPreviewMessage(newest)) {
      requestAnimationFrame(() => {
        const r = scrollRootRef.current;
        if (!r) return;
        const d = r.scrollHeight - r.scrollTop - r.clientHeight;
        if (d >= CHAT_NEAR_BOTTOM_PX) setNewMessagePreview(newest);
      });
    }

    if (scrollToAnchor && lastScrollAnchorKeyRef.current !== scrollToAnchor.key) {
      lastScrollAnchorKeyRef.current = scrollToAnchor.key;
      const targetId = scrollToAnchor.anchorId;
      if (!targetId) {
        restoringReadBoundaryRef.current = false;
        scrollRootToBottomInstant(root);
        followTailRef.current = true;
        setIsAtBottomIfChanged(setIsAtBottom, true);
      } else {
        restoringReadBoundaryRef.current = true;
        followTailRef.current = false;
        scrollReadBoundaryToBottom(root, targetId, groups, followTailRef, setIsAtBottom);
        distFromBottomRef.current = root.scrollHeight - root.scrollTop - root.clientHeight;
        scrollPreserveRef.current = {
          sh: root.scrollHeight,
          st: root.scrollTop,
        };
        requestAnimationFrame(() => {
          const r = scrollRootRef.current;
          if (!r || lastScrollAnchorKeyRef.current !== scrollToAnchor.key) return;
          scrollReadBoundaryToBottom(r, targetId, groups, followTailRef, setIsAtBottom);
          distFromBottomRef.current = r.scrollHeight - r.scrollTop - r.clientHeight;
          scrollPreserveRef.current = { sh: r.scrollHeight, st: r.scrollTop };
          requestAnimationFrame(() => {
            if (lastScrollAnchorKeyRef.current !== scrollToAnchor.key) return;
            followTailRef.current = false;
            restoringReadBoundaryRef.current = false;
          });
        });
      }
    }

    if (didTailScroll) {
      requestAnimationFrame(() => {
        const r = scrollRootRef.current;
        if (!r || !followTailRef.current) return;
        scrollRootToBottomInstant(r);
        scrollPreserveRef.current = { sh: r.scrollHeight, st: r.scrollTop };
        const d = r.scrollHeight - r.scrollTop - r.clientHeight;
        setIsAtBottomIfChanged(setIsAtBottom, d < CHAT_NEAR_BOTTOM_PX);
      });
    }
  }, [messages, scrollToAnchor, groups, readMarkerMessageId, readDividerPlacement]);

  useEffect(() => {
    const root = scrollRootRef.current;
    const sentinel = topSentinelRef.current;
    if (!root || !sentinel || !onLoadOlder || !hasMoreOlder) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit && !isLoadingOlder) {
          onLoadOlder();
        }
      },
      { root, rootMargin: "48px 0px 0px 0px", threshold: 0 },
    );

    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [onLoadOlder, hasMoreOlder, isLoadingOlder]);

  useEffect(() => {
    const root = scrollRootRef.current;
    const sentinel = bottomSentinelRef.current;
    if (!root || !sentinel || !onLoadNewer || !hasMoreNewer) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit && !isLoadingNewer) {
          onLoadNewer();
        }
      },
      { root, rootMargin: "0px 0px 48px 0px", threshold: 0 },
    );

    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [onLoadNewer, hasMoreNewer, isLoadingNewer]);

  useEffect(() => {
    if (!smoothJumpToBottom) return;
    const root = scrollRootRef.current;
    if (!root) return;
    const finish = () => setSmoothJumpToBottom(false);
    root.addEventListener("scrollend", finish);
    const t = window.setTimeout(finish, 800);
    return () => {
      root.removeEventListener("scrollend", finish);
      window.clearTimeout(t);
    };
  }, [smoothJumpToBottom]);

  useLayoutEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;

    const restore = () => {
      applyScrollAnchor(root, followTailRef.current, distFromBottomRef.current);
      const dist = root.scrollHeight - root.scrollTop - root.clientHeight;
      const near = dist < CHAT_NEAR_BOTTOM_PX;
      followTailRef.current = near;
      setIsAtBottomIfChanged(setIsAtBottom, near);
      scrollPreserveRef.current = { sh: root.scrollHeight, st: root.scrollTop };
    };

    restore();
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      restore();
      raf2 = requestAnimationFrame(restore);
    });
    const t = window.setTimeout(restore, 320);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(t);
    };
  }, [isMinimized]);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;

    const lastClientHeightRef = { current: root.clientHeight };

    const ro = new ResizeObserver(() => {
      const sbw = root.offsetWidth - root.clientWidth;
      setScrollbarWidth((prev) => (prev === sbw ? prev : sbw));

      const ch = root.clientHeight;
      if (ch === lastClientHeightRef.current) return;
      lastClientHeightRef.current = ch;

      applyScrollAnchor(root, followTailRef.current, distFromBottomRef.current);
      const dist = root.scrollHeight - root.scrollTop - root.clientHeight;
      const near = dist < CHAT_NEAR_BOTTOM_PX;
      followTailRef.current = near;
      setIsAtBottomIfChanged(setIsAtBottom, near);
      scrollPreserveRef.current = { sh: root.scrollHeight, st: root.scrollTop };
    });

    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRootRef}
        onScroll={handleScroll}
        className={cn(
          "chat-message-list-scroll min-h-0 flex-1 bg-white",
          isMinimized && "chat-message-list-scroll--minimized",
        )}
      >
        <div className={cn("flex flex-col", isMinimized ? "gap-1 px-2" : "gap-1 px-3")}>
          <div ref={topSentinelRef} className={cn("shrink-0", isMinimized ? "min-h-1" : "min-h-2")} aria-hidden />
          {isLoadingOlder ? (
            <div
              className={cn(
                "mb-2 flex min-h-[1.25rem] items-center justify-center text-center text-body-s-regular mobile:text-body-xs-regular text-black/45",
                isMinimized && "mb-1.5 min-h-4 text-body-xs-regular",
              )}
            >
              <Spinner aria-label="이전 메시지 불러오는 중" size={isMinimized ? 16 : 20} />
            </div>
          ) : null}
          {readMarkerMessageId != null && readDividerPlacement?.beforeFirst && groups.length > 0 ? (
            <ChatReadDivider isMinimized={isMinimized} />
          ) : null}
          {groups.map((group, groupIndex) => {
            const type = group[0].type;
            const showReadDividerAfter =
              readMarkerMessageId != null &&
              readDividerPlacement?.afterMessageId != null &&
              group.some((m) => m.id === readDividerPlacement.afterMessageId);

            const inner =
              type === "system" ? (
                <div className={cn("flex flex-col items-center", isMinimized ? "gap-0.5" : "gap-1")}>
                  {group.map((m) => (
                    <SystemMessage key={m.id} message={m} isMinimized={isMinimized} />
                  ))}
                </div>
              ) : type === "place" ? (
                <PlaceShareCard message={group[0]} isMinimized={isMinimized} />
              ) : type === "mine" ? (
                <MyMessageGroup messages={group} isMinimized={isMinimized} onCancelAiRequest={onCancelAiRequest} />
              ) : type === "ai" ? (
                <AiMessageGroup messages={group} isMinimized={isMinimized} onReplyTargetClick={scrollToMessage} />
              ) : (
                <OtherMessageGroup messages={group} isMinimized={isMinimized} />
              );

            return (
              <div key={group[0].id} className="contents">
                <div data-chat-anchor={group[0].id}>{inner}</div>
                {showReadDividerAfter ? (
                  <ChatReadDivider
                    key={`read-divider-${readMarkerMessageId}-${groupIndex}`}
                    isMinimized={isMinimized}
                  />
                ) : null}
              </div>
            );
          })}
          {isLoadingNewer ? (
            <div
              className={cn(
                "mt-2 flex min-h-[1.25rem] items-center justify-center text-center text-body-s-regular mobile:text-body-xs-regular text-black/45",
                isMinimized && "mt-1.5 min-h-4 text-body-xs-regular",
              )}
            >
              <Spinner aria-label="다음 메시지 불러오는 중" size={isMinimized ? 16 : 20} />
            </div>
          ) : null}
          <div ref={bottomSentinelRef} className="h-px w-full shrink-0" aria-hidden />
          <div ref={bottomRef} className="h-0 shrink-0" />
        </div>
      </div>
      {!isAtBottom && newMessagePreview ? (
        <NewMessagePreviewButton
          scrollbarWidth={scrollbarWidth}
          message={newMessagePreview}
          isMinimized={isMinimized}
          onClick={handleJumpClick}
        />
      ) : null}
      {!isAtBottom && !newMessagePreview ? (
        <JumpToBottomButton isMinimized={isMinimized} scrollbarWidth={scrollbarWidth} onClick={handleJumpClick} />
      ) : null}
    </div>
  );
}
