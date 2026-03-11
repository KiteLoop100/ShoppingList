"use client";

import { useState, useCallback, useRef, type KeyboardEvent } from "react";

const MAX_ALIASES = 20;
const MAX_ALIAS_LENGTH = 100;

interface AliasTagInputProps {
  aliases: string[];
  onChange: (aliases: string[]) => void;
  label: string;
  placeholder?: string;
}

export function AliasTagInput({ aliases, onChange, label, placeholder }: AliasTagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addAlias = useCallback((raw: string) => {
    const trimmed = raw.trim().slice(0, MAX_ALIAS_LENGTH);
    if (!trimmed) return;
    const isDuplicate = aliases.some(
      (a) => a.toLowerCase() === trimmed.toLowerCase(),
    );
    if (isDuplicate || aliases.length >= MAX_ALIASES) return;
    onChange([...aliases, trimmed]);
  }, [aliases, onChange]);

  const removeAlias = useCallback((index: number) => {
    onChange(aliases.filter((_, i) => i !== index));
  }, [aliases, onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addAlias(inputValue);
      setInputValue("");
    } else if (e.key === "Backspace" && inputValue === "" && aliases.length > 0) {
      removeAlias(aliases.length - 1);
    }
  }, [inputValue, aliases, addAlias, removeAlias]);

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-aldi-muted">{label}</label>
      <div
        className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl border-2 border-aldi-muted-light px-2.5 py-1.5 focus-within:border-aldi-blue"
        onClick={() => inputRef.current?.focus()}
      >
        {aliases.map((alias, i) => (
          <span
            key={`${alias}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-aldi-blue/10 py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-aldi-blue"
          >
            {alias}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeAlias(i); }}
              className="rounded-full p-0.5 hover:bg-aldi-blue/20"
              aria-label={`${alias} entfernen`}
            >
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </span>
        ))}
        {aliases.length < MAX_ALIASES && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { if (inputValue.trim()) { addAlias(inputValue); setInputValue(""); } }}
            placeholder={aliases.length === 0 ? placeholder : ""}
            className="min-w-[80px] flex-1 border-none bg-transparent py-1 text-sm outline-none placeholder:text-aldi-muted/50"
          />
        )}
      </div>
      {aliases.length >= MAX_ALIASES && (
        <p className="mt-1 text-xs text-aldi-muted">Max. {MAX_ALIASES} Aliase</p>
      )}
    </div>
  );
}
