"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/BrandLogo";
import { UserAvatar } from "@/components/user/UserAvatar";

import { useQueryClient } from "@tanstack/react-query";

import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { logout } from "@/lib/api/auth";
import { useSessionUser } from "@/hooks/useSessionUser";
import { tearDownClientSession } from "@/lib/client-storage";

export function HomeHeader() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useOnClickOutside(profileRef, () => setOpen(false));

  const { data: user } = useSessionUser();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleLogout = async () => {
    const result = await logout().catch(() => {});
    if (!result?.ok) {
      toast.error("로그아웃에 실패했습니다. 다시 시도해 주세요.");
      return;
    }
    tearDownClientSession({ queryClient });
    router.replace("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-border bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-2">
        <BrandLogo variant="combination" size="S" alt="로고" />

        <div ref={profileRef} className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary transition hover:opacity-90"
            aria-label="프로필"
            aria-expanded={open}
          >
            {user ? (
              <UserAvatar user={user} size={32} />
            ) : (
              <span className="text-[14px] font-semibold text-white">?</span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-full z-50 mt-1 w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-border bg-white shadow-lg">
              {user && (
                <div className="border-b border-gray-border px-4 py-2.5">
                  <p className="truncate text-[14px] font-semibold text-black">
                    {user.nickname}
                  </p>
                  <p className="truncate text-[13px] text-dark-gray">
                    {user.email}
                  </p>
                </div>
              )}
              <Link
                href="/home/my-info"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-between border-b border-gray-border px-4 py-2.5 text-left text-[17px] text-dark-gray transition hover:bg-bubble-gray"
              >
                내 정보
                <ChevronRight className="h-4 w-4 text-dark-gray" aria-hidden />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full px-4 py-2.5 text-left text-[17px] text-dark-gray transition hover:bg-bubble-gray"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
