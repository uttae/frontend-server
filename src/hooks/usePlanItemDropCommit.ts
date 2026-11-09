import { useCallback } from "react";
import { toast } from "sonner";

import {
  useMoveScheduleItemToSchedule,
  useReorderScheduleItem,
} from "@/hooks/useRooms";
import { messageForSaveError } from "@/lib/api/errors";
import { resolvePlanItemDrop, type PlanItemDrop } from "@/lib/plan/planItemDrop";

/**
 * 장소 카드 놓기 — PC·모바일 드래그 컨트롤러가 함께 쓴다. 놓은 결과를 순서 변경이나 일차 간 이동으로 보내고
 * 실패하면 토스트를 띄운다. 캐시 반영과 분석 이벤트는 각 mutation 훅이 맡는다.
 * 저장 중·연결 끊김·다른 사람의 변경 중에도 막지 않는다 — 어긋나도 onSettled 재조회가 맞춘다.
 */
export function usePlanItemDropCommit(roomId: string) {
  const { mutateAsync: reorderAsync } = useReorderScheduleItem();
  const { mutateAsync: moveAsync } = useMoveScheduleItemToSchedule();

  /**
   * 보냈으면 true(끝나면 성공·실패 모두 `onSettled`), 제자리라 보내지 않았으면 false.
   * 잠금이 없어 앞 저장 중에 또 놓을 수 있다 — `mutate` 호출부 콜백은 마지막 호출만 따르므로 저장마다 promise가 따로인 `mutateAsync`로 받는다
   */
  const commitPlanItemDrop = useCallback(
    (drop: PlanItemDrop, onSettled: () => void): boolean => {
      const save = resolvePlanItemDrop(roomId, drop);
      if (!save) return false;
      const saving =
        save.kind === "reorder"
          ? reorderAsync(save.vars).catch(() => toast.error("순서를 바꾸지 못했어요."))
          : moveAsync(save.vars).catch((err: unknown) =>
              toast.error(messageForSaveError(err, "다른 일차로 옮기지 못했어요.")),
            );
      void saving.finally(onSettled);
      return true;
    },
    [moveAsync, reorderAsync, roomId],
  );

  return { commitPlanItemDrop };
}
