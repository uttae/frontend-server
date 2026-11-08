"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { SignLogoutIcon, UserIcon } from "@/assets/icons";
import { BrandLogo } from "@/components/BrandLogo";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuHeader,
  DropdownMenuHeaderDescription,
  DropdownMenuHeaderTitle,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user/UserAvatar";

import { useQueryClient } from "@tanstack/react-query";

import { logout } from "@/lib/api/auth";
import { useSessionUser } from "@/hooks/useSessionUser";
import { tearDownClientSession } from "@/lib/client-storage";

export function HomeHeader() {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const { data: user } = useSessionUser();

  const handleLogout = async () => {
    const result = await logout().catch(() => {});
    if (!result?.ok) {
      toast.error("로그아웃에 실패했습니다. 다시 시도해 주세요.");
      return;
    }
    tearDownClientSession({ queryClient });
    // 로그인 중 prefetch된 `/`(→ `/home` 리다이렉트)를 재사용하지 않도록 문서 이동으로 라우터 캐시를 비운다.
    window.location.replace("/");
  };

  return (
    <header className={`sticky top-0 z-40 h-16 shrink-0 border-b border-border-subtle bg-fill-subtle mobile:h-14 ${pathname === "/home" ? "mobile:border-b" : "mobile:border-b-0"}`}>
      <div className="mx-auto flex h-full max-w-[1184px] items-center justify-between gap-4 px-6 mobile:px-5">
        <div className="[&_img]:h-[22px] [&_img]:w-[75.5px]">
          <BrandLogo variant="combination" size="S" alt="로고" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="프로필"
            className="flex size-12 items-center justify-center rounded-[8px] transition hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary"
          >
            {user?.profileImageUrl ? (
              <UserAvatar user={user} size={36} />
            ) : (
              <Avatar size={36} aria-hidden />
            )}
          </DropdownMenuTrigger>
          {/* 지금 자리 그대로: 48px 버튼 기준 right 8px, top 48.5px(Figma 프로필 오버레이 L 3314:3242) */}
          <DropdownMenuContent align="end" alignOffset={8} sideOffset={0.5} size="lg" className="w-60">
            {user && (
              <DropdownMenuHeader>
                <DropdownMenuHeaderTitle>{user.nickname}</DropdownMenuHeaderTitle>
                <DropdownMenuHeaderDescription>{user.email}</DropdownMenuHeaderDescription>
              </DropdownMenuHeader>
            )}
            <DropdownMenuLinkItem render={<Link href="/home/my-info" />}>
              <UserIcon />
              내 정보
            </DropdownMenuLinkItem>
            {/* 지금처럼 로그아웃 요청 중에도 메뉴를 열어 두고, 실패하면 토스트만 띄운다(성공하면 문서 이동) */}
            <DropdownMenuItem closeOnClick={false} onClick={handleLogout}>
              <SignLogoutIcon />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
