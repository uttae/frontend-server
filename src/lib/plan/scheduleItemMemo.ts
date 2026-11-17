import { z } from "zod";

export const SCHEDULE_ITEM_MEMO_MAX_LENGTH = 2000;
export const SCHEDULE_ITEM_MEMO_TOO_LONG_MESSAGE = `메모는 ${SCHEDULE_ITEM_MEMO_MAX_LENGTH}자 이하여야 해요.` as const;

/**
 * 일정 장소 메모 칸(PC 카드 안 편집·모바일 시트). 입력 칸에 길이 제한(maxLength)을 두지 않고 쓰는 동안 이 스키마로 검사한다.
 * 칸 아래 글자 수와 같은 기준(입력한 그대로의 길이)으로 보고, 저장할 값은 앞뒤 공백을 뺀다
 */
export const scheduleItemMemoSchema = z
  .string()
  .max(SCHEDULE_ITEM_MEMO_MAX_LENGTH, SCHEDULE_ITEM_MEMO_TOO_LONG_MESSAGE)
  .trim();
