export type PackingMemo = { id: number; itemId: number; content: string };
export type PackingItem = { id: number; partId: number; name: string; checked: boolean; position: number; memo: PackingMemo | null; tips: string[] };
export type PackingPart = { id: number; name: string; position: number; column: number; items: PackingItem[] };
export type PackingList = { id: number; roomId: string; ownerUserId: number; version: number; initializedAt: string; parts: PackingPart[] };
export type PackingPartWrite = { version: number; part: PackingPart };
export type PackingItemWrite = { version: number; item: PackingItem };
export type PackingPartDelete = { version: number; deletedPartId: number };
export type PackingItemDelete = { version: number; deletedItemId: number };
