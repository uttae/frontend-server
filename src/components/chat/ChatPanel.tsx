"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMainChromeLayoutWidth } from "@/contexts/MainChromeLayoutWidthContext";
import { useChat } from "@/hooks/useChat";
import { useCurrentRoomTitle } from "@/hooks/useCurrentRoomTitle";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useCurrentRoomId } from "@/hooks/use-room-id";
import { useRoomMembers } from "@/hooks/useRooms";
import { ChatPanelHeader } from "./ChatPanelHeader";
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
  panelVariants,
  panelTransition,
  getPanelAnimate,
} from "./chat-animations";

export function ChatPanel({
  mobileInline = false,
  inline = false,
}: {
  mobileInline?: boolean;
  inline?: boolean;
}) {
  const router = useRouter();
  const { chatState, openChat, minimizeChat, closeChat } = useChat();
  const { chatPanelDockWidthCss, chatPanelRevealReady } =
    useMainChromeLayoutWidth();
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

  const title = useCurrentRoomTitle(roomId);
  const { data: membersData } = useRoomMembers(roomId);
  const onlineCount =
    membersData?.members.filter((m) => m.isOnline).length ?? 0;
  const {
    messages,
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

  function handlePlusClick() {
    if (!rid) return;
    router.push("/search?share=chat");
    minimizeChat();
  }

  const panelBody = (
    <>
      {!isInline ? (
        <ChatPanelHeader
          roomTitle={title}
          onlineCount={onlineCount}
          isMinimized={isMinimized}
          onMaximize={openChat}
          onMinimize={minimizeChat}
          onClose={closeChat}
        />
      ) : null}
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
        onPlusClick={handlePlusClick}
        plusDisabled={!rid || mobileInline}
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
          animate={getPanelAnimate(true)}
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
      {chatState === "maximized" && chatPanelRevealReady ? (
        <motion.div
          key="chat-panel-maximized"
          variants={panelVariants}
          initial="hidden"
          animate={getPanelAnimate(false)}
          exit="exit"
          transition={panelTransition}
          style={
            chatPanelDockWidthCss ? { width: chatPanelDockWidthCss } : undefined
          }
          className="absolute top-0 left-0 bottom-0 z-10 flex min-w-0 w-s1 flex-col overflow-hidden bg-white"
        >
          {panelBody}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
