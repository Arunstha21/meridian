"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { SubmitButton } from "./submit-button";

const DialogCloseContext = createContext<() => void>(() => {});

export function useDialogClose() {
  return useContext(DialogCloseContext);
}

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
  children: React.ReactNode;
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
    <DialogCloseContext.Provider value={close}>
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
        <div className="p-5">{children}</div>
      </dialog>
    </DialogCloseContext.Provider>
  );
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "destructive",
  action,
  children
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "destructive" | "secondary";
  action: (formData: FormData) => void | Promise<void>;
  children?: React.ReactNode;
}) {
  return (
    <Dialog trigger={trigger} title={title} description={description}>
      <ConfirmForm action={action} confirmLabel={confirmLabel} variant={variant}>
        {children}
      </ConfirmForm>
    </Dialog>
  );
}

function ConfirmForm({
  action,
  confirmLabel,
  variant,
  children
}: {
  action: (formData: FormData) => void | Promise<void>;
  confirmLabel: string;
  variant: "destructive" | "secondary";
  children?: React.ReactNode;
}) {
  const close = useDialogClose();
  return (
    <form action={action} className="flex flex-wrap justify-end gap-2">
      {children}
      <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm">
        Cancel
      </button>
      <SubmitButton variant={variant}>{confirmLabel}</SubmitButton>
    </form>
  );
}
