import { useCallback } from "react";
import { toast } from "sonner";

import { useMoveScheduleItemToSchedule, useReorderScheduleItem } from "@/hooks/useRooms";
import { messageForSaveError } from "@/lib/api/errors";
import { resolvePlanItemDrop, type PlanItemDrop } from "@/lib/plan/planItemDrop";

export function usePlanItemDropCommit(roomId: string) {
  const { mutateAsync: reorderAsync } = useReorderScheduleItem();
  const { mutateAsync: moveAsync } = useMoveScheduleItemToSchedule();

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
