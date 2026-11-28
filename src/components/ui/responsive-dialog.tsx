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
  DialogTrigger,
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
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useMobileView } from "@/contexts/MobileViewContext";

const ResponsiveDialogIsDrawerContext = createContext(false);

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
  onOpenChange?: (open: boolean, eventDetails: DialogChangeEventDetails | DrawerChangeEventDetails) => void;
  onOpenChangeComplete?: (open: boolean) => void;
  closeDisabled?: boolean;
  disablePointerDismissal?: boolean;
  drawer?: boolean;
  children?: ReactNode;
};

function ResponsiveDialog({ drawer, ...props }: Readonly<ResponsiveDialogProps>) {
  const { isMobileDevice } = useMobileView();
  const isDrawer = drawer ?? isMobileDevice;
  return (
    <ResponsiveDialogIsDrawerContext value={isDrawer}>
      {isDrawer ? <Drawer {...props} /> : <Dialog {...props} />}
    </ResponsiveDialogIsDrawerContext>
  );
}

type ResponsiveDialogTriggerProps = Omit<
  ComponentProps<typeof DialogTrigger>,
  "className" | "render" | "handle" | "payload"
> & {
  className?: string;
  render?: ReactElement;
};

function ResponsiveDialogTrigger(props: Readonly<ResponsiveDialogTriggerProps>) {
  return useResponsiveDialogIsDrawer() ? <DrawerTrigger {...props} /> : <DialogTrigger {...props} />;
}

type ResponsiveDialogContentProps = {
  size?: ComponentProps<typeof DialogContent>["size"];
  fixedWidth?: boolean;
  drawerSize?: ComponentProps<typeof DrawerContent>["size"];
  closeLabel?: string;
  showCloseButton?: boolean;
  initialFocus?: ComponentProps<typeof DialogContent>["initialFocus"];
  finalFocus?: ComponentProps<typeof DialogContent>["finalFocus"];
  className?: string;
  children?: ReactNode;
};

function ResponsiveDialogContent({
  size,
  fixedWidth,
  drawerSize,
  showCloseButton,
  ...props
}: Readonly<ResponsiveDialogContentProps>) {
  const isDrawer = useResponsiveDialogIsDrawer();
  return isDrawer ? (
    <DrawerContent size={drawerSize} {...props} />
  ) : (
    <DialogContent size={size} fixedWidth={fixedWidth} showCloseButton={showCloseButton} {...props} />
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

function ResponsiveDialogBody(props: Readonly<ComponentProps<"div">>) {
  return useResponsiveDialogIsDrawer() ? <DrawerBody {...props} /> : <DialogBody {...props} />;
}

function ResponsiveDialogFooter(props: Readonly<ComponentProps<"div">>) {
  return useResponsiveDialogIsDrawer() ? <DrawerFooter {...props} /> : <DialogFooter {...props} />;
}

type ResponsiveDialogCloseProps = Omit<ComponentProps<typeof DialogClose>, "className" | "render"> & {
  className?: string;
  render?: ReactElement;
};

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
  ResponsiveDialogTrigger,
};
