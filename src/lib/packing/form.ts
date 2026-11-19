import { z } from "zod";

import { normalizePackingMemo, normalizePackingName, PackingValidationError } from "./validation";

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
