"use client";

import { useMutation } from "convex/react";
import { useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  formatPeso,
  GROUP_RATE,
  GROUP_THRESHOLD,
  PAYMENT_ACCOUNT,
  ratePerPerson,
  spellCount,
  titleCaseCount,
} from "@convex/shared";
import { CopyButton } from "@/components/CopyButton";
import { Button, Eyebrow, Field, Spinner, TextInput, cn } from "@/components/ui";
import {
  formatBytes,
  validateFile,
  type PaymentDraft,
  type PaymentErrors,
} from "@/lib/registerForm";

function fileKind(name: string): string {
  const ext = name.split(".").pop()?.toUpperCase() ?? "FILE";
  return ext === "JPEG" ? "JPG" : ext.slice(0, 4);
}

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
  const grouped = participantCount >= GROUP_THRESHOLD;

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
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      const { storageId } = (await response.json()) as { storageId: string };
      onChange({ storageId, fileName: file.name, fileSize: file.size });
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? `That didn't upload — ${error.message}. Try again?`
          : "That didn't upload. Try again?",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      {/* ------------------------------------------------------ the total */}
      <div className="flex flex-col gap-1 rounded-2xl bg-cg-purple p-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:px-6 sm:py-5.5">
        <div className="flex flex-col gap-1">
          <Eyebrow className="text-white/60">Your total</Eyebrow>
          <span className="text-[14px] leading-normal text-white/80">
            {titleCaseCount(participantCount)} of you at the {formatPeso(rate)}{" "}
            {grouped ? "group rate" : "rate"}
          </span>
        </div>
        <span className="font-display text-[36px] leading-none font-bold tracking-[-0.03em] text-cg-gold sm:text-[40px]">
          {formatPeso(total)}
        </span>
      </div>

      {/* --------------------------------------------------- where to send */}
      <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
        <div className="flex flex-col gap-2">
          <Eyebrow>Deposit to</Eyebrow>
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[14.5px] leading-normal">
            <dt className="text-muted">Bank</dt>
            <dd className="font-medium">
              {PAYMENT_ACCOUNT.bank} · {PAYMENT_ACCOUNT.branch}
            </dd>
            <dt className="text-muted">Account name</dt>
            <dd className="font-medium">{PAYMENT_ACCOUNT.accountName}</dd>
            <dt className="text-muted">Account number</dt>
            <dd className="font-semibold tracking-[0.02em]">
              {PAYMENT_ACCOUNT.accountNumber}
            </dd>
          </dl>
        </div>
        <CopyButton
          value={PAYMENT_ACCOUNT.accountNumber}
          label="Copy number"
          className="h-10 w-full justify-center px-4 text-[14px] sm:w-auto"
        />
      </div>

      {/* ------------------------------------------------------ the fields */}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Reference number on the slip"
          value={payment.paymentReference}
          error={errors.paymentReference}
          placeholder="BDO123456"
          onChange={(e) => onChange({ paymentReference: e.target.value })}
        />
        <TextInput
          label="When you paid"
          type="date"
          value={payment.datePaid}
          error={errors.datePaid}
          onChange={(e) => onChange({ datePaid: e.target.value })}
        />
      </div>

      {/* ------------------------------------------------------ the upload */}
      <Field
        label="Photo of the receipt"
        error={errors.storageId ?? uploadError ?? undefined}
        hint={`A photo or PDF is fine, up to 10 MB. One for ${participantCount > 1 ? "the whole group" : "your registration"}.`}
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
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-4 py-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="flex size-10 flex-none items-center justify-center rounded-[10px] bg-cg-blue-tint text-[12px] font-semibold text-cg-blue-ink">
                {fileKind(payment.fileName)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-medium text-ink">
                  {payment.fileName}
                </p>
                <p className="text-[13px] text-muted">
                  {formatBytes(payment.fileSize)}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                onChange({ storageId: null, fileName: "", fileSize: 0 });
                setUploadError(null);
              }}
            >
              Change
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
              "flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-dashed p-5 transition-colors",
              dragging
                ? "border-cg-purple-soft bg-cg-purple-tint"
                : "border-[#cfc9de] bg-surface hover:border-cg-purple-soft hover:bg-cg-purple-tint",
              uploading && "cursor-wait opacity-70",
            )}
          >
            {uploading ? (
              <>
                <Spinner className="size-5 text-cg-purple" />
                <span className="text-[14px] font-medium text-muted">
                  Uploading…
                </span>
              </>
            ) : (
              <>
                <span className="text-[15px] font-semibold text-cg-purple">
                  Take a photo or choose a file
                </span>
                <span className="text-[13px] text-muted">
                  Photo or PDF, up to 10 MB
                </span>
              </>
            )}
          </button>
        )}
      </Field>

      <p className="text-[13px] leading-normal text-muted">
        We keep what you send here for the team to check by hand. Nothing is
        verified automatically, so don&rsquo;t worry if it takes a few days.
        {participantCount >= GROUP_THRESHOLD &&
          ` The ${formatPeso(GROUP_RATE)} rate is already applied for ${spellCount(participantCount)}.`}
      </p>
    </div>
  );
}
