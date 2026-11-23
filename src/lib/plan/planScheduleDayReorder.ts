import { setHtmlDragImageFromPointer } from "@/lib/dnd/setHtmlDragImageFromPointer";

export const PLAN_SCHEDULE_DAY_DND_INDEX_MIME = "application/x-plan-schedule-day-index";

export function beginPlanScheduleDayDrag(event: DragEvent, source: HTMLElement, fromIndex: number): void {
  setHtmlDragImageFromPointer(event, source);
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) return;

  dataTransfer.effectAllowed = "move";
  dataTransfer.setData(PLAN_SCHEDULE_DAY_DND_INDEX_MIME, String(fromIndex));
  dataTransfer.setData("text/plain", String(fromIndex));
}

export function isPlanScheduleDayDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(PLAN_SCHEDULE_DAY_DND_INDEX_MIME);
}

export function readPlanScheduleDayDragIndex(dataTransfer: DataTransfer): number {
  const raw = dataTransfer.getData(PLAN_SCHEDULE_DAY_DND_INDEX_MIME) || dataTransfer.getData("text/plain");
  return parseInt(raw, 10);
}
