import { z } from "zod";

export const SCHEDULE_ITEM_MEMO_MAX_LENGTH = 2000;
export const SCHEDULE_ITEM_MEMO_TOO_LONG_MESSAGE = `메모는 ${SCHEDULE_ITEM_MEMO_MAX_LENGTH}자 이하여야 해요.` as const;

/**
 * 일정 장소 메모 칸(PC 카드 안 편집·모바일 시트). 앞뒤 공백을 뺀 길이를 보고, 저장할 값도 뺀 값이다.
 * 입력은 maxLength로 막히지만 한글 조합 중 넘칠 수 있어 저장 전에 한 번 더 본다
 */
export const scheduleItemMemoSchema = z
  .string()
  .trim()
  .max(SCHEDULE_ITEM_MEMO_MAX_LENGTH, SCHEDULE_ITEM_MEMO_TOO_LONG_MESSAGE);
