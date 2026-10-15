"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
  id?: string;
}

/**
 * Debounced search field (§39). Emits immediately when cleared so the UI feels
 * instant, and after `debounceMs` of idle typing otherwise.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  debounceMs = 350,
  className,
  inputClassName,
  autoFocus,
  ariaLabel,
  id,
}: SearchInputProps) {
  const [local, setLocal] = React.useState(value);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the field in sync when the URL/query drives the value (back button,
  // "clear filters", server redirect).
  React.useEffect(() => {
    setLocal((prev) => (prev === value ? prev : value));
  }, [value]);

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function emit(next: string, immediate = false) {
    setLocal(next);
    if (timer.current) clearTimeout(timer.current);
    if (immediate) {
      onChange(next);
      return;
    }
    timer.current = setTimeout(() => onChange(next), debounceMs);
  }

  return (
    <div className={cn("relative w-full", className)}>
      <Search
        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id={id}
        type="search"
        role="searchbox"
        aria-label={ariaLabel ?? placeholder}
        autoFocus={autoFocus}
        value={local}
        placeholder={placeholder}
        onChange={(e) => emit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (timer.current) clearTimeout(timer.current);
            onChange(local);
          }
          if (e.key === "Escape" && local) emit("", true);
        }}
        className={cn("ps-9 pe-9", inputClassName)}
      />
      {local && (
        <button
          type="button"
          onClick={() => emit("", true)}
          className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={ariaLabel ? `${ariaLabel}: clear` : "Clear"}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
