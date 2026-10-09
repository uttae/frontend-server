"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { MapWithDetailPanel } from "@/components/map";
import { useMobileView } from "@/contexts/MobileViewContext";

/** `/map` — 모바일 전용 지도 화면. PC는 지도가 레이아웃에 붙어 있어 일정으로 보낸다 */
export default function MapPage() {
  const router = useRouter();
  const { isMobileDevice } = useMobileView();

  useEffect(() => {
    if (!isMobileDevice) router.replace("/plan");
  }, [isMobileDevice, router]);

  if (!isMobileDevice) return null;
  return <MapWithDetailPanel mobileInline />;
}
