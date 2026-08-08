"use client";

import { useMutation } from "convex/react";
import { useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  formatPeso,
  GROUP_THRESHOLD,
  PAYMENT_ACCOUNT,
  ratePerPerson,
} from "@convex/shared";
import { CopyButton } from "@/components/CopyButton";
import {
  Button,
  Callout,
  Field,
  SectionLabel,
  Spinner,
  TextInput,
  cn,
} from "@/components/ui";
import {
  formatBytes,
  validateFile,
  type PaymentDraft,
  type PaymentErrors,
} from "@/lib/registerForm";

export function PaymentStep({
  payment,
  errors,
  participantCount,
  total,
  onChange,
}: {
  payment: PaymentDraft;
  errors: PaymentErrors;
  participantCount: number;
  total: number;
  onChange: (patch: Partial<PaymentDraft>) => void;
}) {
  const generateUploadUrl = useMutation(api.registrations.generateUploadUrl);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const rate = ratePerPerson(participantCount);
  const isGroupRate = participantCount >= GROUP_THRESHOLD;

  async function upload(file: File) {
    const problem = validateFile(file);
    if (problem !== null) {
      setUploadError(problem);
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const url = await generateUploadUrl();
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }
      const { storageId } = (await response.json()) as { storageId: string };
      onChange({ storageId, fileName: file.name, fileSize: file.size });
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? `Upload failed: ${error.message}`
          : "Upload failed. Try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      {/* ---------------------------------------------------------- summary */}
      <div className="rounded-2xl border-2 border-cg-gold bg-cg-gold-tint p-6">
        <SectionLabel>Total amount due</SectionLabel>
        <p className="mt-2 font-display text-4xl font-bold text-ink">
          {formatPeso(total)}
        </p>
        <p className="mt-2 text-[14.5px] text-[#7a5c00]">
          {participantCount} {participantCount === 1 ? "participant" : "participants"}{" "}
          × {formatPeso(rate)}
          {isGroupRate && (
            <span className="ml-1.5 rounded-full bg-cg-gold px-2 py-0.5 text-[11.5px] font-bold text-ink">
              GROUP RATE
            </span>
          )}
        </p>
        {!isGroupRate && (
          <p className="mt-3 text-[13px] leading-relaxed text-[#7a5c00]">
            Add {GROUP_THRESHOLD - participantCount} more{" "}
            {GROUP_THRESHOLD - participantCount === 1 ? "participant" : "participants"}{" "}
            to this registration to reach the group rate of {formatPeso(350)} per
            person.
          </p>
        )}
      </div>

      {/* ---------------------------------------------------------- account */}
      <div>
        <SectionLabel>Send payment to</SectionLabel>
        <dl className="mt-3 divide-y divide-line rounded-xl border border-line">
          {[
            ["Bank", PAYMENT_ACCOUNT.bank],
            ["Account name", PAYMENT_ACCOUNT.accountName],
            ["Branch", PAYMENT_ACCOUNT.branch],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="text-sm font-semibold text-ink">{value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-muted">Account number</dt>
            <dd className="flex items-center gap-2.5">
              <span className="font-mono text-sm font-semibold text-ink">
                {PAYMENT_ACCOUNT.accountNumber}
              </span>
              <CopyButton value={PAYMENT_ACCOUNT.accountNumber} />
            </dd>
          </div>
        </dl>
      </div>

      {/* ----------------------------------------------------------- fields */}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Payment reference number"
          value={payment.paymentReference}
          error={errors.paymentReference}
          placeholder="e.g. BDO123456"
          hint="The reference or transaction number on your receipt."
          onChange={(e) => onChange({ paymentReference: e.target.value })}
        />
        <TextInput
          label="Date paid"
          type="date"
          value={payment.datePaid}
          error={errors.datePaid}
          onChange={(e) => onChange({ datePaid: e.target.value })}
        />
      </div>

      {/* ----------------------------------------------------------- upload */}
      <Field
        label="Proof of payment"
        error={errors.storageId ?? uploadError ?? undefined}
        hint="JPG, PNG, or PDF. Maximum 10 MB."
      >
        <input
          ref={fileInput}
          type="file"
          accept={ALLOWED_UPLOAD_EXTENSIONS}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />

        {payment.storageId !== null ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <svg
              viewBox="0 0 20 20"
              className="size-5 shrink-0 text-emerald-600"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="m6.5 10.25 2.25 2.25 4.75-5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-emerald-900">
                {payment.fileName}
              </p>
              <p className="text-[12.5px] text-emerald-700">
                {formatBytes(payment.fileSize)} · uploaded
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onChange({ storageId: null, fileName: "", fileSize: 0 });
                setUploadError(null);
              }}
            >
              Replace
            </Button>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void upload(file);
            }}
            className={cn(
              "flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 transition-colors",
              dragging
                ? "border-cg-purple bg-cg-purple-tint"
                : "border-line bg-surface hover:border-cg-purple-soft/60 hover:bg-cg-purple-tint/40",
              uploading && "cursor-wait opacity-70",
            )}
          >
            {uploading ? (
              <>
                <Spinner className="size-5 text-cg-purple" />
                <span className="text-sm font-medium text-muted">Uploading…</span>
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  className="size-6 text-cg-purple"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 15.5V4m0 0L7.5 8.5M12 4l4.5 4.5"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3.5 15v2.5a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3V15"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-sm font-semibold text-ink">
                  Upload your screenshot or receipt
                </span>
                <span className="text-[12.5px] text-muted">
                  Click to browse, or drag a file here
                </span>
              </>
            )}
          </button>
        )}
      </Field>

      <Callout tone="info">
        We record what you submit here. We do not verify payments automatically —
        the CrossGen team reviews them separately.
      </Callout>
    </div>
  );
}
