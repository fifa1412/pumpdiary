"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";

import { Button } from "@/components/ui/button";

export function ScreenshotLightbox({
  open,
  src,
  alt,
  closeLabel,
  onClose,
  triggerRef,
  flipped = false,
}: {
  open: boolean;
  src: string;
  alt: string;
  closeLabel: string;
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
  flipped?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={alt}
      onCancel={onClose}
      onClose={() => {
        onClose();
        triggerRef?.current?.focus();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto max-h-[96dvh] max-w-[98vw] bg-transparent p-0 text-foreground backdrop:bg-black/85"
      style={{ touchAction: "pinch-zoom" }}
    >
      <div className="relative flex max-h-[96dvh] max-w-[98vw] items-center justify-center p-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={closeLabel}
          onClick={onClose}
          className="absolute right-3 top-3 z-10"
        >
          <X aria-hidden="true" />
        </Button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={`max-h-[92dvh] max-w-[96vw] object-contain ${flipped ? "scale-x-[-1]" : ""}`}
          style={{ touchAction: "pinch-zoom" }}
        />
      </div>
    </dialog>
  );
}
