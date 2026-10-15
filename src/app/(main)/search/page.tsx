"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMobileView } from "@/contexts/MobileViewContext";

/** Preserve old search links without reinstating a search-only left panel. */
export default function SearchPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { isMobileDevice } = useMobileView();
  const query = params.get("q")?.trim() ?? "";
  const pathname = isMobileDevice ? "/map" : "/plan";
  const search = query ? `?q=${encodeURIComponent(query)}` : "";
  const target = `${pathname}${search}`;
  useEffect(() => {
    router.replace(target);
  }, [router, target]);
  return null;
}
