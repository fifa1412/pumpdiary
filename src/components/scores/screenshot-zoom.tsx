"use client";

import { useRef, useState } from "react";

import { ScreenshotLightbox } from "./screenshot-lightbox";

export function ScreenshotZoom({ src, alt, closeLabel, imageClassName }: {
  src: string;
  alt: string;
  closeLabel: string;
  imageClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={alt}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="block w-full cursor-zoom-in rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={imageClassName ?? "max-h-[calc(100vh-7rem)] w-full rounded-md border object-contain"} />
      </button>
      <ScreenshotLightbox open={open} src={src} alt={alt} closeLabel={closeLabel} onClose={() => setOpen(false)} triggerRef={trigger} />
    </>
  );
}
