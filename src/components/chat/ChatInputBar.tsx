"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Search } from "lucide-react";
import { toast } from "sonner";
import { ChatEnterIcon } from "@/components/icons";
import {
  chatAiLabelMotion,
  chatTapSoft,
  chatTapTransition,
} from "@/components/chat/chat-animations";
import {
  chatTypography,
  resolveChatMessageTypography,
} from "@/components/chat/chat-typography";
import {
  CHAT_AI_MENTION_LABEL,
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_MESSAGE_TOO_LONG_TOAST,
} from "@/components/chat/chat-constants";
import { cn } from "@/lib/utils";

interface ChatInputBarProps {
  isMinimized: boolean;
  onSendChat: (content: string) => void;
  onSendAi: (content: string) => void;
  onPlusClick?: () => void;
  plusDisabled?: boolean;
  sendDisabled?: boolean;
}

function mentionSuffixMatchesAi(valueFromAt: string): boolean {
  const t = valueFromAt.toLowerCase();
  return t.length === 0 || "ai".startsWith(t);
}

/** 고정 인풋바 높이 — 텍스트 2줄(line-height 1.5) + 버튼 행 */
const CHAT_INPUT_BAR_HEIGHT = {
  default: 100,
  minimized: 110,
} as const;

function scrollInputToCaret(el: HTMLTextAreaElement) {
  const caret = el.selectionStart ?? el.value.length;
  const atEnd = caret >= el.value.length;
  if (atEnd) {
    el.scrollTop = el.scrollHeight;
    return;
  }
  const style = getComputedStyle(el);
  const lineHeight =
    Number.parseFloat(style.lineHeight) ||
    Number.parseFloat(style.fontSize) * 1.5;
  const before = el.value.slice(0, caret);
  const lineIndex = before.split("\n").length - 1;
  const targetTop = lineIndex * lineHeight;
  const viewBottom = el.scrollTop + el.clientHeight;
  const lineBottom = targetTop + lineHeight;
  if (targetTop < el.scrollTop) {
    el.scrollTop = targetTop;
  } else if (lineBottom > viewBottom) {
    el.scrollTop = lineBottom - el.clientHeight;
  }
}

export function ChatInputBar({
  isMinimized,
  onSendChat,
  onSendAi,
  onPlusClick,
  plusDisabled = false,
  sendDisabled = false,
}: ChatInputBarProps) {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionAnchor, setMentionAnchor] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputShellRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const updateMentionFromDom = useCallback(
    (v: string, cursor: number, aiOn: boolean) => {
      if (aiOn) {
        setMentionOpen(false);
        setMentionAnchor(null);
        return;
      }
      if (cursor < 1 || v[cursor - 1] !== "@") {
        setMentionOpen(false);
        setMentionAnchor(null);
        return;
      }
      const atPos = cursor - 1;
      const prevOk =
        atPos === 0 || (atPos > 0 && /\s/.test(v.charAt(atPos - 1)));
      if (!prevOk) {
        setMentionOpen(false);
        setMentionAnchor(null);
        return;
      }
      const afterAt = v.slice(atPos + 1, cursor);
      if (!mentionSuffixMatchesAi(afterAt)) {
        setMentionOpen(false);
        setMentionAnchor(null);
        return;
      }
      setMentionOpen(true);
      setMentionAnchor(atPos);
    },
    [],
  );

  useEffect(() => {
    if (!mentionOpen) return;
    function onDocMouseDown(ev: MouseEvent) {
      const shell = inputShellRef.current;
      if (shell && !shell.contains(ev.target as Node)) {
        setMentionOpen(false);
        setMentionAnchor(null);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [mentionOpen]);

  function toggleAi() {
    setAiEnabled((prev) => {
      const next = !prev;
      if (next) {
        setMentionOpen(false);
        setMentionAnchor(null);
        setTimeout(() => {
          const el = inputRef.current;
          if (el) {
            el.focus();
            const end = el.value.length;
            el.setSelectionRange(end, end);
          }
        });
      }
      return next;
    });
  }

  function fillAiDraft(text: string) {
    setMessage(text);
    setTimeout(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        const end = text.length;
        el.setSelectionRange(end, end);
      }
    });
  }

  function pickMentionAi() {
    if (mentionAnchor === null) return;
    const el = inputRef.current;
    if (!el) return;
    const v = el.value;
    const caret = el.selectionStart ?? v.length;
    const before = v.slice(0, mentionAnchor);
    const after = v.slice(caret);
    const merged = before + after;
    setMessage(merged);
    setMentionOpen(false);
    setMentionAnchor(null);
    setAiEnabled(true);
    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target;
    const v = el.value;
    const cursor = el.selectionStart ?? v.length;

    if (!aiEnabled && /^@ai(\s+|$)/i.test(v)) {
      const rest = v.replace(/^@ai\s*/i, "");
      setAiEnabled(true);
      setMentionOpen(false);
      setMentionAnchor(null);
      setMessage(rest);
      requestAnimationFrame(() => {
        const t = inputRef.current;
        if (t) {
          const pos = rest.length;
          t.setSelectionRange(pos, pos);
        }
      });
      return;
    }

    setMessage(v);
    updateMentionFromDom(v, cursor, aiEnabled);
    requestAnimationFrame(() => {
      const t = inputRef.current;
      if (t) scrollInputToCaret(t);
    });
  }

  function handleSend() {
    if (sendDisabled) return;

    const raw = inputRef.current?.value ?? message;
    const trimmed = raw.trim();
    if (!trimmed) return;

    if (trimmed.length > CHAT_MESSAGE_MAX_LENGTH) {
      toast.error(CHAT_MESSAGE_TOO_LONG_TOAST);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    if (aiEnabled) onSendAi(trimmed);
    else onSendChat(trimmed);

    setMessage("");
    setAiEnabled(false);
    setMentionOpen(false);
    setMentionAnchor(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && mentionOpen) {
      e.preventDefault();
      setMentionOpen(false);
      setMentionAnchor(null);
      return;
    }

    if (e.key === "Backspace" && aiEnabled) {
      const el = inputRef.current;
      const ne = e.nativeEvent;
      if (ne.isComposing || ne.keyCode === 229) return;
      if (!el) return;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      /** 맨 앞에서 한 칸 지우기 → @ai 오버레이 해제, 일반 필드에 `@a`만 남김(멘션 이어쓰기) */
      if (start === 0 && start === end) {
        e.preventDefault();
        setAiEnabled(false);
        setMentionAnchor(0);
        setMentionOpen(true);
        setMessage("@a");
        requestAnimationFrame(() => {
          const t = inputRef.current;
          if (t) {
            t.focus();
            t.setSelectionRange(2, 2);
          }
        });
        return;
      }
    }

    if (e.key !== "Enter" || e.shiftKey) return;

    const ne = e.nativeEvent;
    if (ne.isComposing || ne.keyCode === 229) return;

    e.preventDefault();
    handleSend();
  }

  const hasContent = message.trim().length > 0;
  const typo = resolveChatMessageTypography(isMinimized);

  return (
    <div
      className="flex shrink-0 flex-col border-t border-gray-300"
      style={{
        height: isMinimized
          ? CHAT_INPUT_BAR_HEIGHT.minimized
          : CHAT_INPUT_BAR_HEIGHT.default,
      }}
    >
      <div
        ref={inputShellRef}
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-2 pt-1"
      >
        <AnimatePresence>
          {aiEnabled && (
            <motion.span
              key="ai-overlay"
              className={cn(
                "pointer-events-none absolute left-0 top-1",
                typo.inputAiLabel,
              )}
              style={{ paddingLeft: chatTypography.aiOverlayInset }}
              initial={reduceMotion ? false : chatAiLabelMotion.initial}
              animate={
                reduceMotion ? { opacity: 1, x: 0 } : chatAiLabelMotion.animate
              }
              exit={
                reduceMotion ? { opacity: 0, x: 0 } : chatAiLabelMotion.exit
              }
              transition={
                reduceMotion ? { duration: 0 } : chatAiLabelMotion.transition
              }
            >
              {CHAT_AI_MENTION_LABEL}
            </motion.span>
          )}
        </AnimatePresence>
        {mentionOpen && !aiEnabled ? (
          <div className="absolute left-4 right-4 top-full z-20 mt-0.5 overflow-hidden rounded-lg border border-gray-border bg-white py-1 shadow-md">
            <button
              type="button"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => pickMentionAi()}
              aria-label={`${CHAT_AI_MENTION_LABEL}로 AI 질문 모드 적용`}
              className={cn(
                "flex w-full cursor-pointer items-center px-3 py-2 text-left transition hover:bg-light-gray",
                isMinimized ? "text-[13px]" : "text-[14px]",
              )}
            >
              <span className="font-medium text-primary-strong">
                {CHAT_AI_MENTION_LABEL}
              </span>
              <span className="ml-2 text-dark-gray">AI에게 질문하기</span>
            </button>
          </div>
        ) : null}
        <textarea
          ref={inputRef}
          rows={1}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onClick={(e) => {
            const el = e.currentTarget;
            updateMentionFromDom(
              el.value,
              el.selectionStart ?? el.value.length,
              aiEnabled,
            );
          }}
          onSelect={(e) => {
            const el = e.currentTarget;
            updateMentionFromDom(
              el.value,
              el.selectionStart ?? el.value.length,
              aiEnabled,
            );
          }}
          placeholder="Shift+Enter로 줄바꿈"
          className={cn(
            "box-border min-h-0 w-full flex-1 resize-none overflow-y-auto bg-transparent py-1 leading-normal text-black outline-none placeholder:text-black/40 [scrollbar-color:#d9d9d9_transparent]",
            isMinimized ? "text-[13px]" : "text-[14px]",
          )}
          style={
            aiEnabled
              ? { paddingLeft: chatTypography.aiInputPaddingLeft }
              : undefined
          }
        />
      </div>
      <div
        className={cn(
          "flex shrink-0 items-center justify-between px-1 pb-1.5 pt-0.5",
        )}
      >
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={onPlusClick}
            disabled={plusDisabled || !onPlusClick}
            aria-label="검색에서 장소 선택 시 이 방 채팅으로 보냅니다"
            title="장소를 검색해서 고르면 채팅으로 전송돼요"
            className={cn(
              "flex shrink-0 cursor-pointer items-center justify-center rounded-full text-dark-gray transition-colors hover:bg-light-gray disabled:cursor-not-allowed disabled:opacity-40",
              isMinimized ? "h-8 w-8" : "h-9 w-9",
            )}
          >
            <Search
              className={cn(isMinimized ? "h-4 w-4" : "h-5 w-5")}
              strokeWidth={2}
              aria-hidden
            />
          </button>
          <motion.button
            type="button"
            onClick={toggleAi}
            whileTap={reduceMotion ? undefined : chatTapSoft}
            transition={chatTapTransition}
            className={`flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 transition-colors ${
              aiEnabled
                ? "bg-primary text-white"
                : "bg-light-gray text-black/40"
            }`}
          >
            <span className={typo.input}>{CHAT_AI_MENTION_LABEL}</span>
            {aiEnabled && (
              <Check
                className={cn(isMinimized ? "h-3 w-3" : "h-3.5 w-3.5")}
                strokeWidth={3}
              />
            )}
          </motion.button>
          {aiEnabled ? (
            <>
              <motion.button
                type="button"
                onClick={() => fillAiDraft("장소 추천해줘.")}
                whileTap={reduceMotion ? undefined : chatTapSoft}
                transition={chatTapTransition}
                aria-label="입력란에 장소 추천 요청 문구 넣기"
                className={cn(
                  "shrink-0 cursor-pointer rounded-lg border border-gray-border bg-white px-2 py-1 text-black/80 transition hover:bg-light-gray",
                  isMinimized ? "text-xs" : "text-[13px]",
                )}
              >
                장소 추천
              </motion.button>
              <motion.button
                type="button"
                onClick={() => fillAiDraft("대화 요약해줘.")}
                whileTap={reduceMotion ? undefined : chatTapSoft}
                transition={chatTapTransition}
                aria-label="입력란에 대화 요약 요청 문구 넣기"
                className={cn(
                  "shrink-0 cursor-pointer rounded-lg border border-gray-border bg-white px-2 py-1 text-black/80 transition hover:bg-light-gray",
                  isMinimized ? "text-xs" : "text-[13px]",
                )}
              >
                대화 요약
              </motion.button>
            </>
          ) : null}
        </div>
        <motion.button
          type="button"
          onClick={handleSend}
          disabled={sendDisabled}
          aria-label={
            sendDisabled
              ? "메시지를 너무 빠르게 보내 전송이 일시 중지되었습니다"
              : "메시지 보내기"
          }
          whileTap={reduceMotion || sendDisabled ? undefined : chatTapSoft}
          transition={chatTapTransition}
          className={cn(
            "flex items-center gap-2 px-2 py-2 transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40",
            sendDisabled ? "cursor-not-allowed" : "cursor-pointer",
          )}
        >
          <ChatEnterIcon
            className={hasContent ? "text-primary" : "text-light-gray"}
          />
        </motion.button>
      </div>
    </div>
  );
}
