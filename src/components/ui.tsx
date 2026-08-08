"use client";

import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import type { InputHTMLAttributes } from "react";
import { useId } from "react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ------------------------------------------------------------------ button

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

const BUTTON_VARIANTS: Record<string, string> = {
  primary:
    "bg-cg-gold text-ink hover:bg-cg-gold-soft active:bg-cg-gold shadow-sm shadow-cg-gold/30",
  secondary:
    "bg-white text-cg-purple border border-line hover:border-cg-purple-soft hover:bg-cg-purple-tint",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-surface",
  danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
};

const BUTTON_SIZES: Record<string, string> = {
  sm: "h-9 px-3.5 text-sm rounded-lg",
  md: "h-11 px-5 text-[15px] rounded-xl",
  lg: "h-13 px-7 text-base rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
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
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
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
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
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

const CONTROL_CLASS =
  "w-full rounded-xl border bg-white px-3.5 text-[15px] text-ink transition-colors " +
  "placeholder:text-muted/60 focus:outline-none focus:ring-4";

const CONTROL_OK =
  "border-line focus:border-cg-purple-soft focus:ring-cg-purple-soft/15";

const CONTROL_ERROR = "border-red-300 focus:border-red-400 focus:ring-red-100";

export function Field({
  label,
  error,
  hint,
  optional,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
  htmlFor?: string;
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
        <p className="text-[12.5px] font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-[12.5px] text-muted">{hint}</p>
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
  const generatedId = useId();
  const id = props.id ?? generatedId;

  return (
    <Field
      label={label}
      error={error}
      hint={hint}
      optional={optional}
      htmlFor={id}
    >
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        className={cn(
          CONTROL_CLASS,
          "h-11",
          error ? CONTROL_ERROR : CONTROL_OK,
          className,
        )}
      />
    </Field>
  );
}

type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  placeholder?: string;
  options: readonly { value: string | number; label: string }[];
};

export function SelectInput({
  label,
  error,
  hint,
  optional,
  placeholder = "Select…",
  options,
  className,
  ...props
}: SelectInputProps) {
  const generatedId = useId();
  const id = props.id ?? generatedId;

  return (
    <Field
      label={label}
      error={error}
      hint={hint}
      optional={optional}
      htmlFor={id}
    >
      <div className="relative">
        <select
          {...props}
          id={id}
          aria-invalid={error ? true : undefined}
          className={cn(
            CONTROL_CLASS,
            "h-11 cursor-pointer appearance-none pr-10",
            props.value === "" && "text-muted/70",
            error ? CONTROL_ERROR : CONTROL_OK,
            className,
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
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

// ------------------------------------------------------------ misc surfaces

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-white p-6 sm:p-7",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "error" | "success";
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    info: "bg-cg-blue-tint border-cg-blue/25 text-ink",
    warn: "bg-cg-orange-tint border-cg-orange/35 text-ink",
    error: "bg-red-50 border-red-200 text-red-900",
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  } as const;

  return (
    <div className={cn("rounded-xl border p-4 text-sm", tones[tone])}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function Badge({
  children,
  tone = "purple",
}: {
  children: ReactNode;
  tone?: "purple" | "gold" | "blue" | "teal" | "orange" | "neutral";
}) {
  const tones = {
    purple: "bg-cg-purple-tint text-cg-purple",
    gold: "bg-cg-gold-tint text-[#8a6800]",
    blue: "bg-cg-blue-tint text-[#1f6d99]",
    teal: "bg-pcec-teal-tint text-pcec-teal-deep",
    orange: "bg-cg-orange-tint text-[#a5622a]",
    neutral: "bg-surface text-muted",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold tracking-wide",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11.5px] font-semibold tracking-[0.09em] text-muted uppercase">
      {children}
    </p>
  );
}
