"use client";

import { useState } from "react";

export interface QuantityPickerProps {
  quantity: number;
  min?: number;
  onQuantityChange: (q: number) => void;
  onClose: () => void;
  className?: string;
}

export function QuantityPicker({
  quantity,
  min = 0,
  onQuantityChange,
  onClose,
  className = "",
}: QuantityPickerProps) {
  const [value, setValue] = useState(quantity);

  const apply = (q: number) => {
    const next = Math.max(min, q);
    setValue(next);
    onQuantityChange(next);
    if (next === 0) onClose();
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-aldi-muted bg-white p-1 ${className}`}
      role="group"
      aria-label="Menge ändern"
    >
      <button
        type="button"
        className="touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded bg-gray-100 text-aldi-blue hover:bg-gray-200"
        onClick={() => apply(value - 1)}
        aria-label="Menge verringern"
      >
        −
      </button>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) apply(n);
        }}
        className="w-12 rounded border border-aldi-muted bg-transparent text-center text-aldi-text"
        aria-label="Menge"
      />
      <button
        type="button"
        className="touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded bg-aldi-blue text-white hover:opacity-90"
        onClick={() => apply(value + 1)}
        aria-label="Menge erhöhen"
      >
        +
      </button>
    </div>
  );
}
