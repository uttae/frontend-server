import { Toaster as Sonner, type ToasterProps } from "sonner";

import { CircleBanIcon, CircleCheckIcon, CloseIcon } from "@/assets/icons";

type Props = Omit<ToasterProps, "theme" | "richColors" | "icons" | "toastOptions">;

function Toaster(props: Readonly<Props>) {
  return (
    <Sonner
      theme="light"
      containerAriaLabel="알림"
      icons={{
        success: <CircleCheckIcon size={20} className="text-status-positive" />,
        error: <CircleBanIcon size={20} className="text-status-negative" />,
        info: null,
        close: <CloseIcon size={20} />,
      }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: "닫기",
        classNames: {
          toast:
            "flex min-h-13 w-full items-center gap-2 rounded-md border border-border bg-fill-elevate py-1 ps-4 pe-2 font-sans text-text data-[expanded=false]:data-[front=false]:*:opacity-0",
          icon: "shrink-0",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "text-body-s-emphasis",
          description: "text-body-s-regular text-text-subtle",
          actionButton:
            "relative inline-flex min-h-8 shrink-0 cursor-pointer items-center rounded-md bg-fill-elevate px-3.5 py-1.5 text-label-m-regular text-text-subtle underline after:absolute after:inset-x-0 after:-inset-y-1.5 hover:bg-fill active:bg-fill-strong focus-visible:outline-2 focus-visible:outline-primary",
          closeButton:
            "order-last grid size-11 shrink-0 cursor-pointer place-items-center text-icon-subtle focus-visible:outline-2 focus-visible:outline-primary",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
