import { z } from "zod";

/**
 * 약관 동의 스키마. 필수 약관은 서버 목록이 정하고 바뀔 수 있어 고정 키(z.literal(true)) 대신
 * "체크한 동의 id 배열이 서버 필수 목록을 모두 포함하는지"를 본다. 목록이 비면 진행할 수 없다.
 * 화면은 문장 없이 진행 버튼만 잠근다(문구는 화면에 보이지 않는다)
 */
export function createAgreementConsentSchema(requiredIds: string[]) {
  return z
    .array(z.string())
    .refine((acceptedIds) => requiredIds.length > 0 && requiredIds.every((id) => acceptedIds.includes(id)), {
      message: "필수 약관에 모두 동의해 주세요.",
    });
}
