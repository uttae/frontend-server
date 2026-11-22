import { z } from "zod";

export function createAgreementConsentSchema(requiredIds: string[]) {
  return z
    .array(z.string())
    .refine((acceptedIds) => requiredIds.length > 0 && requiredIds.every((id) => acceptedIds.includes(id)), {
      message: "필수 약관에 모두 동의해 주세요.",
    });
}
