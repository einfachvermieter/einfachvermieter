import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/Drawer";
import { useIsMobile } from "@/hooks/use-mobile";

type ResponsiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export const ResponsiveDialog = ({
  open,
  onOpenChange,
  children,
}: ResponsiveDialogProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>{children}</DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">{children}</DialogContent>
    </Dialog>
  );
};

export const ResponsiveDialogHeader = ({
  children,
}: {
  children: ReactNode;
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <DrawerHeader>{children}</DrawerHeader>;
  }

  return <DialogHeader>{children}</DialogHeader>;
};

export const ResponsiveDialogTitle = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const isMobile = useIsMobile();
  const titleClassName =
    className ??
    "font-heading text-lg leading-normal font-semibold text-sky-900";

  if (isMobile) {
    return <DrawerTitle className={titleClassName}>{children}</DrawerTitle>;
  }

  return <DialogTitle className={titleClassName}>{children}</DialogTitle>;
};

export const ResponsiveDialogDescription = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerDescription className={className}>{children}</DrawerDescription>
    );
  }

  return (
    <DialogDescription className={className}>{children}</DialogDescription>
  );
};

export const ResponsiveDialogBody = ({ children }: { children: ReactNode }) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <div className="overflow-y-auto px-4 pb-4">{children}</div>;
  }

  return <>{children}</>;
};
