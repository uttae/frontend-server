import { z } from "zod";

export const SCHEDULE_ITEM_MEMO_MAX_LENGTH = 2000;
export const SCHEDULE_ITEM_MEMO_TOO_LONG_MESSAGE = `메모는 ${SCHEDULE_ITEM_MEMO_MAX_LENGTH}자 이하여야 해요.` as const;

export const scheduleItemMemoSchema = z
  .string()
  .max(SCHEDULE_ITEM_MEMO_MAX_LENGTH, SCHEDULE_ITEM_MEMO_TOO_LONG_MESSAGE)
  .trim();
