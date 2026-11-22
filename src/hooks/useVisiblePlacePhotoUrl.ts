import { useState } from "react";

export function useVisiblePlacePhotoUrl(url: string | null | undefined) {
  const [unavailableUrl, setUnavailableUrl] = useState<string | null>(null);
  const visibleUrl = url && url !== unavailableUrl ? url : null;
  return {
    visibleUrl,
    markUnavailable: () => setUnavailableUrl(visibleUrl),
  };
}
