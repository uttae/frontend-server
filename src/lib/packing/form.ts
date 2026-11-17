import { z } from "zod";

import { normalizePackingMemo, normalizePackingName, PackingValidationError } from "./validation";

/*
 * 준비물 이름·메모 폼 스키마. 규칙과 문구는 API 요청·coordinator가 쓰는 normalize* 함수가 정본이라,
 * 스키마는 그 함수를 불러 던진 오류(PackingValidationError)를 그 칸 issue로 바꾼다
 */
function addPackingIssue(ctx: z.core.$RefinementCtx<string>, check: () => unknown) {
  try {
    check();
  } catch (error) {
    if (!(error instanceof PackingValidationError)) throw error;
    ctx.addIssue({ code: "custom", message: error.message });
  }
}

export const packingNameSchema = {
  part: z.string().superRefine((name, ctx) => addPackingIssue(ctx, () => normalizePackingName(name, "part"))),
  item: z.string().superRefine((name, ctx) => addPackingIssue(ctx, () => normalizePackingName(name, "item"))),
};

export const packingMemoSchema = z.string().superRefine((memo, ctx) => addPackingIssue(ctx, () => normalizePackingMemo(memo)));
