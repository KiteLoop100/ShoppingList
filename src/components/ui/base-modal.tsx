"use client";

import { useEffect, type ReactNode } from "react";

interface BaseModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  ariaLabel?: string;
  children: ReactNode;
}

export function BaseModal({ open, onClose, title, ariaLabel, children }: BaseModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 touch-none"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-2 border-b border-aldi-muted-light p-4">
            <h2 className="text-lg font-semibold text-aldi-text">{title}</h2>
            <button
              type="button"
              className="touch-target -m-2 rounded-lg p-2 text-aldi-muted transition-colors hover:bg-aldi-muted-light/50 hover:text-aldi-text"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
