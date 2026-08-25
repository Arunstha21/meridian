"use client";

import { useEffect, useRef } from "react";

export function Dialog({
  trigger,
  title,
  description,
  children,
  width = "max-w-lg"
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  width?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onClose = () => {
      const opener = (dialog.previousElementSibling as HTMLElement) ?? null;
      opener?.focus();
    };
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  const open = () => ref.current?.showModal();
  const close = () => ref.current?.close();

  return (
    <>
      <button type="button" onClick={open} className="contents cursor-pointer">
        {trigger}
      </button>
      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
        className={`backdrop:bg-black/40 open:flex open:flex-col rounded-xl border border-border bg-surface p-0 text-fg shadow-xl ${width} w-[calc(100vw-2rem)]`}
      >
        <div className="flex flex-col gap-1 border-b border-border p-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-base font-semibold">{title}</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close dialog"
              className="rounded-md p-1 text-muted hover:bg-border/50"
            >
              ✕
            </button>
          </div>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </div>
        <div className="p-5">
          {typeof children === "function" ? children(close) : children}
        </div>
      </dialog>
    </>
  );
}
