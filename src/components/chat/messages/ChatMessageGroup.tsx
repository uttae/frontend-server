import { CHAT_AI_MENTION_LABEL } from "@/components/chat/chat-constants";
import { ChatMarkdownContent } from "@/components/chat/ChatMarkdownContent";
import type { ChatMarkdownVariant } from "@/components/chat/chat-markdown-components";
import { getChatPanelLook } from "@/components/chat/chat-panel-look";
import { AiResponseBubble } from "@/components/chat/messages/AiResponseBubble";
import { ChatMemberAvatarRing } from "@/components/chat/messages/ChatMemberAvatarRing";
import type { ChatMessageTextTypography } from "@/components/chat/chat-typography";
import { cn } from "@/lib/utils";
import type { AiRequestStatus, ChatMessage } from "@/types/chat";
import { Loader2 } from "lucide-react";

function labelForAiStatus(status: AiRequestStatus): string {
  const labels: Record<AiRequestStatus, string> = {
    QUEUED: "다른 요청 처리 중",
    PROCESSING: "AI 처리 중",
    CANCELED: "취소됨",
  };
  return labels[status];
}

function AiRequestMetaRow({
  msg,
  typo,
  onCancelRequest,
  /** 내 AI 요청이면 상태·취소됨 우측 정렬, 상대방이면 좌측 정렬 */
  isOwnMessage = false,
}: {
  msg: ChatMessage;
  typo: ChatMessageTextTypography;
  onCancelRequest?: (requestMessageId: string) => void;
  isOwnMessage?: boolean;
}) {
  const ar = msg.aiRequest;
  if (!ar?.aiStatus) return null;

  const showCancel =
    onCancelRequest != null &&
    ar.cancelable &&
    (ar.aiStatus === "QUEUED" || ar.aiStatus === "PROCESSING");

  if (ar.aiStatus === "CANCELED") {
    return (
      <div
        className={cn(
          "mt-1 flex max-w-full text-[14px]",
          isOwnMessage ? "w-auto self-end justify-end" : "w-full justify-start",
          typo.metaMuted,
        )}
      >
        <span>{labelForAiStatus(ar.aiStatus)}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-1 flex max-w-full flex-row flex-wrap items-center gap-x-2 gap-y-1 text-[14px]",
        isOwnMessage ? "w-auto self-end justify-end" : "w-full justify-start",
        typo.metaMuted,
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {ar.aiStatus === "PROCESSING" ? (
          <span className="inline-flex items-center gap-1.5">
            <span>{labelForAiStatus(ar.aiStatus)}</span>
            <Loader2
              className="h-3.5 w-3.5 shrink-0 animate-spin text-primary-strong"
              aria-hidden
            />
          </span>
        ) : (
          <span>{labelForAiStatus(ar.aiStatus)}</span>
        )}
      </div>
      {showCancel ? (
        <button
          type="button"
          className={cn(
            "shrink-0 cursor-pointer underline underline-offset-2 hover:opacity-90",
            "text-neutral-700",
          )}
          onClick={() => onCancelRequest(ar.requestMessageId)}
        >
          취소
        </button>
      ) : null}
    </div>
  );
}

function BubbleMessageText({
  msg,
  typo,
  variant,
}: {
  msg: ChatMessage;
  typo: ChatMessageTextTypography;
  variant: ChatMarkdownVariant;
}) {
  if (!msg.isAiRequest) {
    return (
      <ChatMarkdownContent
        text={msg.text}
        variant={variant}
        preserveWhitespace
      />
    );
  }
  return (
    <>
      <span className={typo.aiRequestBubblePrefix}>
        {CHAT_AI_MENTION_LABEL}
      </span>
      {msg.text ? (
        <>
          {" "}
          <ChatMarkdownContent
            text={msg.text}
            variant={variant}
            preserveWhitespace
          />
        </>
      ) : null}
    </>
  );
}

function GroupTimeStamp({
  time,
  typo,
  className,
}: {
  time: string;
  typo: ChatMessageTextTypography;
  className?: string;
}) {
  return <span className={cn(typo.metaMuted, className)}>{time}</span>;
}

export function OtherMessageGroup({
  messages,
  isMinimized = false,
}: {
  messages: ChatMessage[];
  isMinimized?: boolean;
}) {
  const { typo, chrome } = getChatPanelLook(isMinimized);
  const first = messages[0];
  const groupTime = messages.findLast((m) => m.time)?.time;

  return (
    <div className="flex gap-2">
      <div className="flex flex-col items-center gap-1">
        <ChatMemberAvatarRing
          chromeAvatarClassName={chrome.avatarSm}
          avatarUrl={first.avatar}
          alt={first.sender ?? ""}
          senderNotInRoom={first.senderNotInRoom}
          reduceMotion
        />
        <span className={typo.metaMuted}>{first.sender}</span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-col gap-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="max-w-full"
              {...(msg.isAiRequest ? { "data-chat-anchor": msg.id } : {})}
            >
              <div
                className={cn(
                  chrome.bubbleBase,
                  chrome.otherBubble,
                  typo.bubble,
                )}
              >
                <BubbleMessageText msg={msg} typo={typo} variant="other" />
              </div>
              {msg.isAiRequest ? (
                <AiRequestMetaRow msg={msg} typo={typo} isOwnMessage={false} />
              ) : null}
            </div>
          ))}
        </div>
        {groupTime && <GroupTimeStamp time={groupTime} typo={typo} />}
      </div>
    </div>
  );
}

export function MyMessageGroup({
  messages,
  isMinimized = false,
  onCancelAiRequest,
}: {
  messages: ChatMessage[];
  isMinimized?: boolean;
  /** 내 AI_REQUEST 만 — `cancelable`·상태 조건 충족 시 취소 STOMP 발행 */
  onCancelAiRequest?: (requestMessageId: string) => void;
}) {
  const { typo, chrome } = getChatPanelLook(isMinimized);
  const groupTime = messages.findLast((m) => m.time)?.time;

  return (
    <div className="flex flex-col items-end gap-1 -mr-1">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className="max-w-full"
          {...(msg.isAiRequest ? { "data-chat-anchor": msg.id } : {})}
        >
          <div
            className={cn(chrome.bubbleBase, chrome.mineBubble, typo.bubble)}
          >
            <BubbleMessageText msg={msg} typo={typo} variant="mine" />
          </div>
          {msg.isAiRequest ? (
            <AiRequestMetaRow
              msg={msg}
              typo={typo}
              onCancelRequest={onCancelAiRequest}
              isOwnMessage
            />
          ) : null}
        </div>
      ))}
      {groupTime && <GroupTimeStamp time={groupTime} typo={typo} />}
    </div>
  );
}

export function SystemMessage({
  message,
  isMinimized = false,
}: {
  message: ChatMessage;
  isMinimized?: boolean;
}) {
  const { typo, chrome } = getChatPanelLook(isMinimized);

  return (
    <div className="flex justify-center px-2">
      <div
        className={cn(chrome.systemPill, typo.systemBody)}
        style={{ whiteSpace: "pre-line" }}
      >
        {message.text}
      </div>
    </div>
  );
}

export function AiMessageGroup({
  messages,
  isMinimized = false,
  onReplyTargetClick,
}: {
  messages: ChatMessage[];
  isMinimized?: boolean;
  onReplyTargetClick?: (requestMessageId: string) => void;
}) {
  const { typo, chrome } = getChatPanelLook(isMinimized);
  const groupTime = messages.findLast((m) => m.time)?.time;

  return (
    <div className="flex gap-2">
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <div
          className={cn(chrome.avatarSm, "bg-white")}
          role="img"
          aria-label="WOORI"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- public 정적 SVG(내장 래스터) */}
          <img
            src={chrome.wooriIconSrc}
            alt="WOORI"
            className="h-full w-full object-contain p-1"
          />
        </div>
        <span className={typo.wooriSenderLabel}>WOORI</span>
      </div>

      <div className="min-w-0">
        <div className="flex flex-col gap-1">
          {messages.map((msg) => (
            <AiResponseBubble
              key={msg.id}
              msg={msg}
              bubbleBase={chrome.bubbleBase}
              aiBubble={chrome.aiBubble}
              typo={typo}
              isMinimized={isMinimized}
              onReplyTargetClick={onReplyTargetClick}
            />
          ))}
        </div>

        {groupTime && (
          <GroupTimeStamp
            time={groupTime}
            typo={typo}
            className="mt-0.5 block"
          />
        )}
      </div>
    </div>
  );
}
