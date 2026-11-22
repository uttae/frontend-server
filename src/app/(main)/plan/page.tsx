"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { PlanPageView } from "./_components/itinerary/PlanPageView";
import { useCurrentRoomId } from "@/hooks/use-room-id";

export default function PlanPage() {
  const router = useRouter();
  const { roomId, roomContextReady } = useCurrentRoomId();

  useEffect(() => {
    if (!roomContextReady || roomId) return;
    router.replace("/home");
  }, [roomContextReady, roomId, router]);

  if (!roomId) {
    return null;
  }

  return <PlanPageView />;
}
