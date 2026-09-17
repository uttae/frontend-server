import { create } from "zustand";
export type MemoDraft = { roomId: string; scheduleId: number; itemId: number; draft: string; baseMemo: string; baseVersion?: number; active: boolean };
export const memoDraftKey = (roomId: string, scheduleId: number, itemId: number) => `${roomId.trim()}:${scheduleId}:${itemId}`;
/** Memory only. A removed/moved card must not destroy the user's unsaved text. */
export const usePlanMemoDraftsStore = create<{
  drafts: Record<string, MemoDraft>;
  put: (key: string, draft: MemoDraft) => void;
  remove: (key: string) => void;
  deactivate: (key: string) => void;
}>((set) => ({
  drafts: {},
  put: (key, draft) => set((s) => ({ drafts: { ...s.drafts, [key]: draft } })),
  remove: (key) => set((s) => { const drafts = { ...s.drafts }; delete drafts[key]; return { drafts }; }),
  deactivate: (key) => set((s) => s.drafts[key] ? { drafts: { ...s.drafts, [key]: { ...s.drafts[key], active: false } } } : s),
}));
