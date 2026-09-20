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
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-fill-subtle mobile:border-b-0">
      <div className="mx-auto flex h-16 max-w-[1184px] items-center justify-between gap-4 px-6 mobile:h-14 mobile:px-5">
        <BrandLogo variant="combination" size="S" alt="로고" />

        <div ref={profileRef} className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex size-12 items-center justify-center rounded-[8px] transition hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="프로필"
            aria-expanded={open}
          >
            {user?.profileImageUrl ? (
              <UserAvatar user={user} size={36} />
            ) : (
              <span className="size-9 rounded-full bg-fill-strong" aria-hidden />
            )}
          </button>

          {open && (
            <div className="absolute right-2 top-full z-50 w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[12px] bg-white text-text shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
              {user && (
                <div className="border-b border-border-subtle py-5 pl-5 pr-4">
                  <p className="truncate text-[18px] font-bold leading-[22px]">
                    {user.nickname}
                  </p>
                  <p className="mt-1 truncate text-body-s-regular text-text-subtle">
                    {user.email}
                  </p>
                </div>
              )}
              <Link
                href="/home/my-info"
                onClick={() => setOpen(false)}
                className="flex min-h-[52px] w-full items-center justify-between border-b border-border-subtle py-3.5 pl-5 pr-4 text-left text-label-l-regular transition hover:bg-fill"
              >
                내 정보
                <ChevronRight className="h-4 w-4 text-dark-gray" aria-hidden />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="min-h-[52px] w-full py-3.5 pl-5 pr-4 text-left text-label-l-regular transition hover:bg-fill"
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
