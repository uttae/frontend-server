import { Toaster as Sonner, type ToasterProps } from "sonner";

import { CircleBanIcon, CircleCheckIcon, CloseIcon } from "@/assets/icons";

// 색·아이콘·글자는 이 부품이 정한다. 화면은 위치·여백·표시 시간 같은 배치·동작만 넘긴다
type Props = Omit<ToasterProps, "theme" | "richColors" | "icons" | "toastOptions">;

function Toaster(props: Readonly<Props>) {
  return (
    <Sonner
      // 다크 모드를 쓰지 않는다. sonner 다크 규칙은 레이어 밖 CSS라 unstyled에도 적용돼 라이트로 고정한다
      theme="light"
      containerAriaLabel="알림"
      icons={{
        success: <CircleCheckIcon size={20} className="text-status-positive" />,
        error: <CircleBanIcon size={20} className="text-status-negative" />,
        // 일반 안내는 아이콘 없이 보인다. 비워 두면 sonner 기본 아이콘이 나와 null로 끈다.
        // warning·loading은 쓰는 곳이 없어 정하지 않았다(쓰면 sonner 기본 아이콘·스피너가 나온다)
        info: null,
        close: <CloseIcon size={20} />,
      }}
      toastOptions={{
        // sonner 기본 CSS는 레이어 밖에 들어가 Tailwind 유틸리티를 이긴다. 끄고 Figma Toast Base(5285:5064)를 토큰으로 그린다
        unstyled: true,
        closeButtonAriaLabel: "닫기",
        classNames: {
          // unstyled가 함께 끄는 목록 폭(w-full)과 접힌 스택의 뒤 토스트 내용 숨김(*:opacity-0)을 되살린다.
          // font-sans: sonner가 목록(ol)에 system-ui 글꼴을 레이어 밖에서 지정해 Pretendard가 상속되지 않는다
          toast:
            "flex min-h-13 w-full items-center gap-2 rounded-md border border-border bg-fill-elevate py-1 ps-4 pe-2 font-sans text-text data-[expanded=false]:data-[front=false]:*:opacity-0",
          icon: "shrink-0",
          // 설명(description)은 Figma에 슬롯이 없어 제목과의 간격은 지금 sonner 값(2px)을 따른다
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "text-body-s-emphasis",
          description: "text-body-s-regular text-text-subtle",
          // Figma Button Neutral Weak·XS. 보이는 높이는 32px 그대로 두고 누르는 영역만 의사 요소로 44px까지 넓힌다
          actionButton:
            "relative inline-flex min-h-8 shrink-0 cursor-pointer items-center rounded-md bg-fill-elevate px-3.5 py-1.5 text-label-m-regular text-text-subtle underline after:absolute after:inset-x-0 after:-inset-y-1.5 hover:bg-fill active:bg-fill-strong focus-visible:outline-2 focus-visible:outline-primary",
          // sonner는 닫기를 첫 자식으로 그린다. Figma 순서(문구 → 액션 → 닫기)로 옮겨 Tab 순서는 닫기가 먼저다
          closeButton:
            "order-last grid size-11 shrink-0 cursor-pointer place-items-center text-icon-subtle focus-visible:outline-2 focus-visible:outline-primary",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
