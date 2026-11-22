"use client";

import { APIProvider } from "@vis.gl/react-google-maps";

import { clientEnv } from "@/lib/client-env";

export function GoogleMapsProvider({ children }: { children: React.ReactNode }) {
  return <APIProvider apiKey={clientEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>{children}</APIProvider>;
}
