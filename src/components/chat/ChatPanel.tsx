"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "@/hooks/useChat";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useCurrentRoomId } from "@/hooks/use-room-id";
import { ChatPanelHeader } from "./ChatPanelHeader";
import { Spinner } from "@/components/ui/spinner";
import { ChatMessageList } from "./messages/ChatMessageList";
import { ChatInputBar } from "./ChatInputBar";
import { ChatRateLimitBanner } from "./ChatRateLimitBanner";
import { ChatPanelMinimizedResizeHandle } from "./ChatPanelMinimizedResizeHandle";
import { useChatRateLimitStore } from "@/stores/chat-rate-limit-store";
import { useChatPanelMinimizedSize } from "@/hooks/useChatPanelMinimizedSize";
import {
  CHAT_PANEL_MINIMIZED_VIEWPORT_INSET_PX,
  CHAT_PANEL_MINIMIZED_VIEWPORT_INSET_RIGHT_PX,
} from "@/lib/chat/chat-panel-minimized-size";
import {
  minimizedPanelAnimate,
  panelVariants,
  panelTransition,
} from "./chat-animations";

export function ChatPanel({
  mobileInline = false,
  inline = false,
}: {
  mobileInline?: boolean;
  inline?: boolean;
}) {
  const { chatState, openChat, minimizeChat, closeChat } = useChat();
  const isInline = mobileInline || inline;
  const isMinimized = !isInline && chatState === "minimized";
  const panelOpen = isInline || chatState !== "closed";
  const { roomId } = useCurrentRoomId();
  const rid = typeof roomId === "string" ? roomId.trim() : "";
  const [mobileHistoryReadyState, setMobileHistoryReadyState] = useState({
    rid: "",
    ready: false,
  });

  useEffect(() => {
    if (!mobileInline) return;

    let timer = 0;
    const raf = requestAnimationFrame(() => {
      timer = window.setTimeout(
        () => setMobileHistoryReadyState({ rid, ready: true }),
        0,
      );
    });

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [mobileInline, rid]);
  const mobileHistoryReady =
    mobileHistoryReadyState.ready && mobileHistoryReadyState.rid === rid;

  const {
    messages,
    waitingForMembers,
    sendChatMessage,
    sendAiMessage,
    sendCancelAiRequest,
    fetchOlderMessages,
    fetchNewerMessages,
    jumpToLatest,
    hasMore,
    hasMoreNewer,
    isFetchingOlder,
    isFetchingNewer,
    readMarkerMessageId,
    readDividerPlacement,
    scrollToAnchor,
    markMessagesRead,
  } = useChatMessages(roomId, {
    fetchHistory: mobileInline ? mobileHistoryReady : panelOpen,
  });

  const rateLimit = useChatRateLimitStore((s) => s.rateLimit);
  const isSendBlocked = useChatRateLimitStore((s) => s.isSendBlocked);
  const { size: minimizedSize, setSize, persistSize, clampSize } =
    useChatPanelMinimizedSize();

  const panelBody = (
    <>
      {!mobileInline ? (
        <ChatPanelHeader
          isMinimized={isMinimized}
          onMaximize={openChat}
          onMinimize={minimizeChat}
          onClose={closeChat}
        />
      ) : null}
      {waitingForMembers ? (
        // 보낸 사람 이름(멤버 목록)을 받기 전에는 메시지 대신 로딩 표시 — 받으면 이름과 함께 한 번에 그린다.
        // 목록은 이때 처음 마운트되므로 읽음 위치 스크롤도 메시지가 다 그려진 뒤에 처리된다
        <div className="flex min-h-0 flex-1 items-center justify-center bg-white">
          <Spinner aria-label="채팅 불러오는 중" size={isMinimized ? 16 : 20} />
        </div>
      ) : (
        <ChatMessageList
          key={rid || "no-room"}
          messages={messages}
          isMinimized={isMinimized}
          onCancelAiRequest={sendCancelAiRequest}
          onLoadOlder={fetchOlderMessages}
          hasMoreOlder={hasMore}
          isLoadingOlder={isFetchingOlder}
          onLoadNewer={fetchNewerMessages}
          hasMoreNewer={hasMoreNewer}
          isLoadingNewer={isFetchingNewer}
          onJumpToLatest={jumpToLatest}
          readMarkerMessageId={readMarkerMessageId}
          readDividerPlacement={readDividerPlacement}
          scrollToAnchor={scrollToAnchor}
          onAtBottom={markMessagesRead}
        />
      )}
      <AnimatePresence initial={false}>
        {rateLimit ? (
          <ChatRateLimitBanner
            key="chat-rate-limit"
            message={rateLimit.message}
            isMinimized={isMinimized}
          />
        ) : null}
      </AnimatePresence>
      <ChatInputBar
        isMinimized={isMinimized}
        onSendChat={sendChatMessage}
        onSendAi={sendAiMessage}
        sendDisabled={isSendBlocked}
      />
    </>
  );

  if (isInline) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white">
        {panelBody}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {chatState === "minimized" ? (
        <motion.div
          key="chat-panel-minimized"
          variants={panelVariants}
          initial="hidden"
          animate={minimizedPanelAnimate}
          exit="exit"
          transition={panelTransition}
          style={{
            width: minimizedSize.width,
            height: minimizedSize.height,
            bottom: CHAT_PANEL_MINIMIZED_VIEWPORT_INSET_PX,
            right: CHAT_PANEL_MINIMIZED_VIEWPORT_INSET_RIGHT_PX,
          }}
          className="absolute z-20 flex flex-col overflow-hidden rounded-2xl border border-gray-border bg-white"
        >
          <ChatPanelMinimizedResizeHandle
            size={minimizedSize}
            onResize={setSize}
            onResizeEnd={persistSize}
            clampSize={clampSize}
          />
          {panelBody}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
