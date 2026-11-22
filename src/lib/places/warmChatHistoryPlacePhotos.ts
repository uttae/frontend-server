import type { QueryClient } from "@tanstack/react-query";

import type { ServerChatMessage } from "@/types/chat";

export async function warmPlacePhotoQueriesFromChatHistory(
  queryClient: QueryClient,
  history: ServerChatMessage[],
): Promise<void> {
  void queryClient;
  void history;
}
