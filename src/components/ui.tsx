"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { useEffect, useId, useState } from "react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ------------------------------------------------------------------ button

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "quiet";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  full?: boolean;
};

const VARIANTS: Record<string, string> = {
  primary: "bg-cg-gold text-ink hover:bg-cg-gold-soft",
  outline:
    "bg-white text-cg-purple border border-line hover:bg-cg-purple-tint hover:border-cg-purple-soft",
  quiet: "bg-transparent text-muted hover:text-ink",
};

const SIZES: Record<string, string> = {
  sm: "h-9.5 px-3.5 text-[13.5px] rounded-[10px]",
  md: "h-12 px-6 text-[15px] rounded-xl",
  lg: "h-13 px-7 text-base rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  full = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        full && "w-full",
        className,
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-4 animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ------------------------------------------------------------------- field

// 16px on phones so iOS doesn't zoom the viewport on focus; 15px from sm up.
const CONTROL =
  "w-full rounded-xl border bg-white px-3.5 h-12 sm:h-11 text-[16px] sm:text-[15px] " +
  "text-ink transition-colors placeholder:text-faint focus:outline-none";

const CONTROL_OK = "border-line focus:border-cg-purple-soft";
const CONTROL_BAD = "border-red-300 focus:border-red-400";

export function Field({
  label,
  error,
  hint,
  optional,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-baseline gap-2 text-[13px] font-medium text-ink"
      >
        {label}
        {optional && (
          <span className="text-[12px] font-normal text-muted">Optional</span>
        )}
      </label>
      {children}
      {error ? (
        <p className="text-[12.5px] leading-snug font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-[12.5px] leading-snug text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
};

export function TextInput({
  label,
  error,
  hint,
  optional,
  className,
  ...props
}: TextInputProps) {
  const generated = useId();
  const id = props.id ?? generated;

  return (
    <Field label={label} error={error} hint={hint} optional={optional} htmlFor={id}>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, error ? CONTROL_BAD : CONTROL_OK, className)}
      />
    </Field>
  );
}

type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  options: readonly { value: string | number; label: string }[];
};

export function SelectInput({
  label,
  error,
  hint,
  placeholder = "Choose one",
  options,
  className,
  ...props
}: SelectInputProps) {
  const generated = useId();
  const id = props.id ?? generated;

  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <div className="relative">
        <select
          {...props}
          id={id}
          aria-invalid={error ? true : undefined}
          className={cn(
            CONTROL,
            "cursor-pointer appearance-none pr-10",
            props.value === "" && "text-faint",
            error ? CONTROL_BAD : CONTROL_OK,
            className,
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value} className="text-ink">
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m4 6 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </Field>
  );
}

/** The bordered card used for every choice in a radio group. */
export function ChoiceCard({
  selected,
  onSelect,
  name,
  title,
  blurb,
  align = "start",
}: {
  selected: boolean;
  onSelect: () => void;
  name: string;
  title: ReactNode;
  blurb?: string;
  align?: "start" | "center";
}) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer gap-3.5 rounded-xl border px-4 py-3.5 transition-colors sm:px-[18px]",
        align === "start" ? "items-start" : "items-center",
        selected
          ? "border-[1.5px] border-cg-purple-soft bg-cg-purple-tint"
          : "border-line bg-white hover:border-cg-purple-soft hover:bg-surface",
      )}
    >
      <input
        id={id}
        type="radio"
        name={name}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        className={cn(
          "size-[18px] flex-none rounded-full bg-white transition-all",
          align === "start" && "mt-0.5",
          selected
            ? "border-5 border-cg-purple"
            : "border-[1.5px] border-faint",
        )}
        aria-hidden="true"
      />
      <span className="flex flex-col gap-0.5">
        <span
          className={cn(
            "text-[15px] leading-snug sm:text-[15px]",
            blurb ? "font-semibold text-[16px]" : selected ? "font-medium" : "font-normal",
            "text-ink",
          )}
        >
          {title}
        </span>
        {blurb && (
          <span className="text-[14px] leading-normal text-muted">{blurb}</span>
        )}
      </span>
    </label>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  error,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  error?: boolean;
}) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors",
        checked
          ? "border-[1.5px] border-cg-purple-soft bg-cg-purple-tint"
          : error
            ? "border-red-300 bg-white"
            : "border-line bg-white hover:border-cg-purple-soft hover:bg-surface",
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={cn(
          "mt-0.5 flex size-[18px] flex-none items-center justify-center rounded-[5px] border-[1.5px] transition-colors",
          checked
            ? "border-cg-purple bg-cg-purple text-white"
            : error
              ? "border-red-300 bg-white"
              : "border-faint bg-white",
        )}
        aria-hidden="true"
      >
        {checked && (
          <svg viewBox="0 0 14 14" className="size-3" fill="none">
            <path
              d="m2.5 7.5 3 3 6-7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="text-[14.5px] leading-normal text-ink">{label}</span>
    </label>
  );
}

/**
 * Confirmation dialog for something that cannot be undone. Deliberately not a
 * generic modal: it takes the exact words the person must type, so a
 * destructive action can never be a stray click on a focused button.
 */
export function ConfirmDialog({
  title,
  children,
  confirmWord,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  children: ReactNode;
  confirmWord: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Mounted only while open, so the typed confirmation resets by construction
  // rather than by an effect racing the render that opened it.
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const matches = typed.trim().toUpperCase() === confirmWord.toUpperCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-[2px] sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-[460px] rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="font-display text-[20px] leading-tight font-semibold text-ink">
          {title}
        </h2>
        <div className="mt-3 text-[14.5px] leading-relaxed text-muted">
          {children}
        </div>

        <label className="mt-5 flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">
            Type <span className="font-mono font-semibold">{confirmWord}</span> to
            confirm
          </span>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-white px-3.5 font-mono text-[15px] text-ink"
          />
        </label>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="quiet" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <button
            type="button"
            disabled={!matches || busy === true}
            onClick={onConfirm}
            className={cn(
              "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold transition-colors",
              "bg-red-600 text-white hover:bg-red-700",
              "disabled:cursor-not-allowed disabled:bg-red-600/40",
            )}
          >
            {busy === true && <Spinner />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ pieces

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-[11.5px] font-semibold tracking-[0.09em] uppercase",
        className ?? "text-muted",
      )}
    >
      {children}
    </span>
  );
}

export function Pill({
  children,
  tone = "purple",
}: {
  children: ReactNode;
  tone?: "purple" | "teal" | "gold" | "muted";
}) {
  const tones = {
    purple: "bg-cg-purple-tint text-cg-purple",
    teal: "bg-pcec-teal-tint text-pcec-teal-deep",
    gold: "bg-cg-gold-tint text-cg-gold-ink",
    muted: "bg-surface text-muted",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5 text-[12.5px] font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Callout({
  tone = "gold",
  title,
  children,
}: {
  tone?: "gold" | "teal" | "error";
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    gold: "bg-cg-gold-tint text-ink",
    teal: "bg-pcec-teal-tint text-ink",
    error: "bg-red-50 text-red-900",
  } as const;
  const titles = {
    gold: "text-cg-gold-ink",
    teal: "text-pcec-teal-deep",
    error: "text-red-700",
  } as const;

  return (
    <div className={cn("rounded-xl px-4.5 py-4", tones[tone])}>
      {title && (
        <p className={cn("text-[14.5px] font-semibold", titles[tone])}>{title}</p>
      )}
      <div className="text-[14.5px] leading-normal">{children}</div>
    </div>
  );
}

/** label / value row with a hairline above it — the design's main list idiom. */
export function Row({
  label,
  value,
  strong,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-5 border-t border-line py-3">
      <span className="text-[14.5px] text-muted">{label}</span>
      <span
        className={cn(
          "text-right text-[14.5px] text-ink",
          strong ? "font-semibold" : "font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}
