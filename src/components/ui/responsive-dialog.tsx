"use client";

import { createContext, use, type ComponentProps, type ReactElement, type ReactNode } from "react";

import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMobileView } from "@/contexts/MobileViewContext";

// 반응형 대화상자(DECISIONS 'Dialog'): PC는 Dialog, 모바일 기기(useMobileView().isMobileDevice)는 아래 시트 Drawer.
// 같은 내용(폼·목록)을 두 껍데기에 넣는다. 파트 이름·순서는 Dialog·Drawer와 같고, Root가 고른 모드를 context로 내린다.
// 모드는 UA 기준이라 열린 채 바뀌지 않는다(바뀌면 다른 Root로 다시 마운트돼 안쪽 상태를 잃는다).
//
// @example
// <ResponsiveDialog open={open} onOpenChange={setOpen} closeDisabled={isSaving}>
//   <ResponsiveDialogContent size="md" closeLabel="예산 설정 닫기">
//     <ResponsiveDialogHeader>
//       <ResponsiveDialogTitle>예산 설정</ResponsiveDialogTitle>
//     </ResponsiveDialogHeader>
//     <ResponsiveDialogBody>
//       <form id={formId} onSubmit={handleSubmit}>…</form>
//     </ResponsiveDialogBody>
//     <ResponsiveDialogFooter>
//       <ResponsiveDialogClose render={<Button variant="weak" />}>취소</ResponsiveDialogClose>
//       <Button type="submit" form={formId} loading={isSaving} loadingLabel="저장 중">저장</Button>
//     </ResponsiveDialogFooter>
//   </ResponsiveDialogContent>
// </ResponsiveDialog>

const ResponsiveDialogIsDrawerContext = createContext(false);

// 파트들이 Root와 같은 껍데기를 고르게 한다. 내용이 모드별로 달라야 하면 화면이 useMobileView()를 직접 읽는다
function useResponsiveDialogIsDrawer() {
  return use(ResponsiveDialogIsDrawerContext);
}

type DialogRootProps = ComponentProps<typeof Dialog>;
type DrawerRootProps = ComponentProps<typeof Drawer>;
type DialogChangeEventDetails = Parameters<NonNullable<DialogRootProps["onOpenChange"]>>[1];
type DrawerChangeEventDetails = Parameters<NonNullable<DrawerRootProps["onOpenChange"]>>[1];

type ResponsiveDialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  /** eventDetails는 두 껍데기의 공통 모양(reason·event·cancel)이다. Drawer는 reason에 "swipe"가 더 있다 */
  onOpenChange?: (open: boolean, eventDetails: DialogChangeEventDetails | DrawerChangeEventDetails) => void;
  /** 닫힘 애니메이션까지 끝난 뒤. 폼 초기화 등 정리는 여기서(onOpenChangeComplete(false)) */
  onOpenChangeComplete?: (open: boolean) => void;
  /** 저장 중처럼 닫으면 안 될 때 true. Esc·딤·X·취소(ResponsiveDialogClose)·스와이프를 모두 막는다 */
  closeDisabled?: boolean;
  /** 딤을 눌러도 닫히지 않게 한다(두 껍데기 모두). PC에서만 막으려면 화면이 isMobileDevice로 값을 고른다 */
  disablePointerDismissal?: boolean;
  children?: ReactNode;
};

function ResponsiveDialog(props: Readonly<ResponsiveDialogProps>) {
  const { isMobileDevice } = useMobileView();
  return (
    <ResponsiveDialogIsDrawerContext value={isMobileDevice}>
      {isMobileDevice ? <Drawer {...props} /> : <Dialog {...props} />}
    </ResponsiveDialogIsDrawerContext>
  );
}

type ResponsiveDialogContentProps = {
  /** PC Dialog 폭(default 353 · sm 384 · md 448 · lg 640 · xl 720). 시트는 화면 폭이라 쓰지 않는다 */
  size?: ComponentProps<typeof DialogContent>["size"];
  /** 시트 높이(auto 내용 높이 · belowNav · belowSafeArea). PC는 쓰지 않는다 */
  drawerSize?: ComponentProps<typeof DrawerContent>["size"];
  /** 닫기 X의 접근성 이름(예: "예산 설정 닫기") */
  closeLabel?: string;
  /** PC 제목 줄 X 표시(기본 true). 시트 X는 Figma에 숨김 속성이 없어 늘 그린다 */
  showCloseButton?: boolean;
  initialFocus?: ComponentProps<typeof DialogContent>["initialFocus"];
  finalFocus?: ComponentProps<typeof DialogContent>["finalFocus"];
  /** 배치(높이 상한 등)에만 쓴다. 두 껍데기 모두에 붙는다 */
  className?: string;
  children?: ReactNode;
};

function ResponsiveDialogContent({ size, drawerSize, showCloseButton, ...props }: Readonly<ResponsiveDialogContentProps>) {
  const isDrawer = useResponsiveDialogIsDrawer();
  return isDrawer ? (
    <DrawerContent size={drawerSize} {...props} />
  ) : (
    <DialogContent size={size} showCloseButton={showCloseButton} {...props} />
  );
}

function ResponsiveDialogHeader(props: Readonly<ComponentProps<"div">>) {
  return useResponsiveDialogIsDrawer() ? <DrawerHeader {...props} /> : <DialogHeader {...props} />;
}

function ResponsiveDialogTitle(props: Readonly<{ className?: string; children?: ReactNode }>) {
  return useResponsiveDialogIsDrawer() ? <DrawerTitle {...props} /> : <DialogTitle {...props} />;
}

function ResponsiveDialogDescription(props: Readonly<{ className?: string; children?: ReactNode }>) {
  return useResponsiveDialogIsDrawer() ? <DrawerDescription {...props} /> : <DialogDescription {...props} />;
}

/**
 * 본문. 두 껍데기 모두 본문만 스크롤하고 제목 줄·Footer는 고정한다(시트 DrawerBody, PC DialogBody).
 * 안쪽 간격은 두 껍데기 모두 없어 넣는 내용이 정한다(className="gap-2" 또는 폼 자신의 gap)
 */
function ResponsiveDialogBody(props: Readonly<ComponentProps<"div">>) {
  return useResponsiveDialogIsDrawer() ? <DrawerBody {...props} /> : <DialogBody {...props} />;
}

function ResponsiveDialogFooter(props: Readonly<ComponentProps<"div">>) {
  return useResponsiveDialogIsDrawer() ? <DrawerFooter {...props} /> : <DialogFooter {...props} />;
}

type ResponsiveDialogCloseProps = Omit<ComponentProps<typeof DialogClose>, "className" | "render"> & {
  className?: string;
  /** 취소 버튼은 render={<Button variant="weak" />} */
  render?: ReactElement;
};

/** 닫는 버튼. closeDisabled이면 비활성으로 보인다 */
function ResponsiveDialogClose(props: Readonly<ResponsiveDialogCloseProps>) {
  return useResponsiveDialogIsDrawer() ? <DrawerClose {...props} /> : <DialogClose {...props} />;
}

export {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
};
