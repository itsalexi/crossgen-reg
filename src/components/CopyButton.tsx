"use client";

import { useEffect, useState } from "react";
import { cn } from "./ui";

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => setCopied(true));
      }}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5",
        "text-[12.5px] font-semibold text-cg-purple transition-colors hover:bg-cg-purple-tint",
        className,
      )}
    >
      {copied ? (
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
          <path
            d="m3.5 8.5 3 3 6-7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
          <rect
            x="5.5"
            y="5.5"
            width="8"
            height="8"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M10.5 3.5A2 2 0 0 0 8.5 2h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 1.5 1.94"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
      {copied ? "Copied" : label}
    </button>
  );
}
