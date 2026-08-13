"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  breakoutTitle,
  formatDatePaid,
  formatPeso,
  heardFromLabel,
  typeShort,
  type RegistrationType,
} from "@convex/shared";
import { Button, ConfirmDialog, Eyebrow, Spinner } from "@/components/ui";
import { buildParticipantCsv, downloadCsv } from "@/lib/csv";
import { amountText, EmailTag, longDate, ReceiptTag, SourceTag } from "./parts";

function isImage(name: string | undefined): boolean {
  return /\.(jpe?g|png)$/i.test(name ?? "");
}

export function RegistrationDetail({
  registrationId,
  onBack,
}: {
  registrationId: Id<"registrations">;
  onBack: () => void;
}) {
  const detail = useQuery(api.organizer.get, { registrationId });
  const resend = useMutation(api.organizer.resendConfirmation);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const remove = useMutation(api.organizer.deleteRegistration);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (detail === undefined) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-5 text-cg-purple" />
      </div>
    );
  }
  if (detail === null) return null;

  const { registration, participants, paymentProofUrl } = detail;
  const shared =
    participants.length > 1 &&
    participants.every(
      (p) =>
        p.churchOrganization === participants[0].churchOrganization &&
        p.cityMunicipality === participants[0].cityMunicipality,
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onBack}
          className="text-[13.5px] font-medium text-cg-purple hover:underline"
        >
          All registrations
        </button>
        <span className="text-[13.5px] text-faint">/</span>
        <span className="text-[13.5px] font-medium text-muted">
          {registration.registrationNumber}
        </span>
      </div>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-[26px] leading-tight font-semibold text-ink">
              {registration.groupName ?? registration.registrantName}
            </h1>
            <SourceTag registration={registration} />
          </div>
          <span className="text-[14.5px] leading-normal text-muted">
            {registration.registrationNumber} · registered{" "}
            {longDate(registration.submittedAt ?? registration._creationTime)} by{" "}
            {registration.registrantEmail}
          </span>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            loading={resending}
            onClick={() => {
              setResending(true);
              void resend({ registrationId })
                .then(() => setResent(true))
                .finally(() => setResending(false));
            }}
          >
            {resent ? "Sent again" : "Resend email"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(
                `${registration.registrationNumber}.csv`,
                buildParticipantCsv([{ registration, participants }]),
              )
            }
          >
            Export
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-5">
        {[
          ["Type", typeShort(registration.registrationType as RegistrationType)],
          ["People", String(registration.participantCount)],
          ["Amount", amountText(registration)],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <Eyebrow>{label}</Eyebrow>
            <dd className="font-display text-[16px] font-semibold text-ink">
              {value}
            </dd>
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <Eyebrow>Receipt</Eyebrow>
          <dd>
            <ReceiptTag registration={registration} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <Eyebrow>Email</Eyebrow>
          <dd>
            <EmailTag registration={registration} />
          </dd>
        </div>
      </dl>

      <dl className="flex flex-col gap-2 rounded-2xl border border-line bg-white px-5 py-4 text-[14px] sm:flex-row sm:gap-10">
        <div>
          <dt className="text-muted">Heard about it from</dt>
          <dd className="font-medium text-ink">
            {heardFromLabel(registration.heardFrom, registration.heardFromOther)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Agreements</dt>
          <dd className="font-medium text-ink">
            {registration.consentAccurate === undefined
              ? "Not asked at the time"
              : registration.consentAccurate &&
                  registration.consentDataUse &&
                  registration.consentPhotos
                ? "All three agreed"
                : "Incomplete"}
          </dd>
        </div>
      </dl>

      {registration.amountUnknown === true && (
        <p className="text-[13px] leading-relaxed text-muted">
          This came from the Google Form, which recorded that a payment was made
          but not how much. Check the receipt against the reference number.
        </p>
      )}

      {registration.confirmationEmailError && (
        <p className="text-[13px] leading-normal text-red-600">
          Confirmation email failed: {registration.confirmationEmailError}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="border-b border-line text-[11.5px] font-semibold tracking-[0.07em] text-muted uppercase">
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-2 py-3 font-semibold">Age</th>
                  <th className="px-2 py-3 font-semibold">Contact</th>
                  <th className="px-5 py-3 font-semibold">Session</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr
                    key={p._id}
                    className="border-b border-line-soft align-baseline text-[14px] last:border-0"
                  >
                    <td className="px-5 py-3.5 font-medium text-ink">
                      {p.fullName}
                      {p.preferredName && (
                        <span className="ml-1 font-normal text-muted">
                          ({p.preferredName})
                        </span>
                      )}
                      <div className="text-[12.5px] font-normal text-muted">
                        {p.gender} · {p.maritalStatus} · {p.occupation}
                      </div>
                      {!shared && (
                        <div className="text-[12.5px] font-normal text-muted">
                          {p.churchOrganization} · {p.cityMunicipality}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-3.5 text-muted">{p.age}</td>
                    <td className="px-2 py-3.5 text-muted">
                      {p.mobileNumber}
                      <div className="text-[12.5px]">{p.email}</div>
                    </td>
                    <td className="px-5 py-3.5 text-muted">
                      {breakoutTitle(p.breakoutSession)}
                      <div className="text-[12.5px]">
                        Serves: {p.ministryInvolvement}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shared && (
            <p className="border-t border-line px-5 py-3 text-[13px] text-muted">
              Everyone lists {participants[0].churchOrganization},{" "}
              {participants[0].cityMunicipality}.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Eyebrow>Receipt</Eyebrow>
          {registration.paymentType === "exempt" ? (
            <p className="text-[14px] leading-normal text-muted">
              Exempt — {registration.exemptionReason}. Nothing was collected.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-white">
              {registration.paymentProofExternalUrl !== undefined ? (
                <div className="flex h-44 flex-col items-center justify-center gap-2 bg-surface px-4 text-center">
                  <span className="text-[13.5px] text-muted">
                    Kept in the organizers&rsquo; Google Drive
                  </span>
                  <a
                    href={registration.paymentProofExternalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[14px] font-semibold text-cg-purple hover:underline"
                  >
                    Open in Drive
                  </a>
                </div>
              ) : paymentProofUrl !== null &&
                isImage(registration.paymentProofFileName) ? (
                <a href={paymentProofUrl} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={paymentProofUrl}
                    alt={`Receipt for ${registration.registrationNumber}`}
                    className="h-44 w-full bg-surface object-contain"
                  />
                </a>
              ) : (
                <div className="flex h-44 items-center justify-center bg-surface px-4 text-center">
                  <span className="text-[13.5px] text-muted">
                    {registration.paymentProofFileName ?? "No file attached"}
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-2.5 border-t border-line px-4 py-3.5">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 text-[13.5px] leading-normal">
                  <dt className="text-muted">Reference</dt>
                  <dd className="font-medium">{registration.paymentReference}</dd>
                  <dt className="text-muted">Paid</dt>
                  <dd className="font-medium">
                    {formatDatePaid(registration.datePaid ?? "")}
                  </dd>
                </dl>
                {paymentProofUrl !== null && (
                  <a
                    href={paymentProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-9.5 items-center justify-center rounded-[10px] border border-line bg-white text-[14px] font-semibold text-cg-purple hover:border-cg-purple-soft hover:bg-cg-purple-tint"
                  >
                    Open full size
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/40 px-5 py-4">
        <div>
          <p className="text-[14.5px] font-semibold text-ink">
            Remove this registration
          </p>
          <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted">
            Deletes {registration.participantCount}{" "}
            {registration.participantCount === 1 ? "person" : "people"} and the
            uploaded receipt. This cannot be undone.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50"
          onClick={() => {
            setDeleteError(null);
            setConfirming(true);
          }}
        >
          Remove
        </Button>
      </div>

      {deleteError !== null && (
        <p className="text-[13px] font-medium text-red-600">{deleteError}</p>
      )}

      {confirming && (
      <ConfirmDialog
        title="Remove this registration?"
        confirmWord={registration.registrationNumber}
        confirmLabel="Remove permanently"
        busy={deleting}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setDeleting(true);
          setDeleteError(null);
          void remove({ registrationId })
            .then(() => {
              setConfirming(false);
              onBack();
            })
            .catch((caught) => {
              setDeleteError(
                caught instanceof ConvexError
                  ? String(caught.data)
                  : "Could not remove that registration.",
              );
              setConfirming(false);
            })
            .finally(() => setDeleting(false));
        }}
      >
        <p>
          <strong className="text-ink">
            {registration.groupName ?? registration.registrantName}
          </strong>{" "}
          — {registration.participantCount}{" "}
          {registration.participantCount === 1 ? "person" : "people"}
          {registration.paymentType === "paid" &&
            registration.paymentReference !== undefined && (
              <> · paid under {registration.paymentReference}</>
            )}
          .
        </p>
        <p className="mt-2">
          Everyone on it goes, along with the uploaded receipt. The payment
          record for that reference stays, because it may cover other
          registrations.
        </p>
      </ConfirmDialog>
      )}
    </div>
  );
}
