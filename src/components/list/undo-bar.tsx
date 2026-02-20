"use client";

export interface UndoBarProps {
  onUndo: () => void;
  onDismiss?: () => void;
  message: string;
  undoLabel: string;
  className?: string;
}

export function UndoBar({
  onUndo,
  onDismiss,
  message,
  undoLabel,
  className = "",
}: UndoBarProps) {
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-20 flex items-center justify-between gap-4 bg-aldi-blue px-4 py-3 text-white shadow-lg transition-transform duration-200 ${className}`}
      role="status"
    >
      <span className="text-sm font-medium">{message}</span>
      <button
        type="button"
        className="touch-target shrink-0 font-semibold text-aldi-orange underline decoration-2 underline-offset-2 transition-opacity hover:opacity-90"
        onClick={() => {
          onUndo();
          onDismiss?.();
        }}
      >
        {undoLabel}
      </button>
    </div>
  );
}
