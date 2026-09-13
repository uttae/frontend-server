import type { QueryClient } from "@tanstack/react-query";
export const expenseKeys = {
  room: (roomId: string) => ["room-expenses", roomId] as const,
  members: (roomId: string) => ["room-expenses", roomId, "members"] as const,
  list: (roomId: string) => ["room-expenses", roomId, "list"] as const,
  summary: (roomId: string) => ["room-expenses", roomId, "summary"] as const,
  currencies: (roomId: string) =>
    ["room-expenses", roomId, "currencies"] as const,
};
export async function invalidateExpenses(client: QueryClient, roomId: string) {
  await client.invalidateQueries({ queryKey: expenseKeys.room(roomId) });
}
