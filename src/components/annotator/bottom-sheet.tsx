"use client";

import { useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Modal bottom sheet built on the shared Sheet (Radix Dialog): focus is trapped and moved in
 * (to the `data-autofocus` element if present), Escape/overlay closes, focus returns to the trigger.
 */
export function BottomSheet({ open, title, onClose, children }: Props) {
  const body = useRef<HTMLDivElement>(null);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        className="mx-auto max-h-[80dvh] w-full max-w-lg gap-0 border-x p-0 pt-5 landscape:max-h-[92dvh]"
        onOpenAutoFocus={(e) => {
          const el = body.current?.querySelector<HTMLElement>("[data-autofocus]");
          if (el) {
            e.preventDefault();
            el.focus();
          }
        }}
      >
        <SheetHeader className="px-4 pb-2 pt-1">
          <SheetTitle className="text-base">{title}</SheetTitle>
        </SheetHeader>
        <div ref={body} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
