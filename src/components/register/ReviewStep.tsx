"use client";

import {
  breakoutTitle,
  EVENT,
  formatPeso,
  GROUP_THRESHOLD,
  isExempt,
  ratePerPerson,
  REGISTRATION_TYPES,
  type RegistrationType,
} from "@convex/shared";
import { Badge, SectionLabel } from "@/components/ui";
import type { ParticipantDraft, PaymentDraft } from "@/lib/registerForm";

function EditLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[13px] font-semibold text-cg-purple underline-offset-2 hover:underline"
    >
      Edit
    </button>
  );
}

export function ReviewStep({
  registrationType,
  groupName,
  participants,
  payment,
  total,
  onEditType,
  onEditParticipant,
  onEditPayment,
}: {
  registrationType: RegistrationType;
  groupName: string;
  participants: ParticipantDraft[];
  payment: PaymentDraft;
  total: number;
  onEditType: () => void;
  onEditParticipant: (index: number) => void;
  onEditPayment: () => void;
}) {
  const exempt = isExempt(registrationType);
  const typeLabel =
    REGISTRATION_TYPES.find((t) => t.value === registrationType)?.label ??
    registrationType;
  const count = participants.length;
  const rate = ratePerPerson(count);

  return (
    <div className="flex flex-col gap-6">
      {/* -------------------------------------------------------- the basics */}
      <section className="rounded-2xl border border-line bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            {groupName.trim().length > 0 && (
              <p className="font-display text-xl font-bold text-ink">
                {groupName.trim()}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge tone={exempt ? "teal" : "purple"}>{typeLabel}</Badge>
              <span className="text-sm text-muted">
                {count} {count === 1 ? "participant" : "participants"}
              </span>
            </div>
          </div>
          <EditLink onClick={onEditType} />
        </div>
      </section>

      {/* ------------------------------------------------------- participants */}
      <section>
        <SectionLabel>Participants</SectionLabel>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {participants.map((participant, index) => (
            <li
              key={index}
              className="flex items-start justify-between gap-4 p-5"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {participant.fullName.trim()}
                  {participant.preferredName.trim().length > 0 && (
                    <span className="ml-1.5 font-normal text-muted">
                      ({participant.preferredName.trim()})
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[13.5px] text-muted">
                  {participant.age} · {participant.gender} ·{" "}
                  {participant.maritalStatus} · {participant.cityMunicipality}
                </p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-cg-purple">
                  {breakoutTitle(Number(participant.breakoutSession))}
                </p>
                <p className="mt-1.5 text-[13px] text-muted">
                  {participant.email} · {participant.mobileNumber}
                </p>
              </div>
              <EditLink onClick={() => onEditParticipant(index)} />
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------ payment */}
      <section>
        <SectionLabel>Payment</SectionLabel>

        {exempt ? (
          <div className="mt-3 rounded-2xl border border-pcec-teal/30 bg-pcec-teal-tint p-6">
            <p className="font-display text-2xl font-bold text-ink">
              {formatPeso(0)}
            </p>
            <p className="mt-1.5 text-[14.5px] text-pcec-teal-deep">
              No payment is required for a {typeLabel.toLowerCase()} registration.
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-line bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[14.5px] text-muted">
                  {count === 1 ? "Regular rate" : count >= GROUP_THRESHOLD ? "Group rate" : "Regular rate"}
                  : {formatPeso(rate)} / person × {count}
                </p>
                <p className="mt-1 font-display text-3xl font-bold text-ink">
                  {formatPeso(total)}
                </p>
              </div>
              <EditLink onClick={onEditPayment} />
            </div>

            <dl className="mt-5 divide-y divide-line border-t border-line">
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-sm text-muted">Payment reference</dt>
                <dd className="text-sm font-semibold text-ink">
                  {payment.paymentReference}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-sm text-muted">Date paid</dt>
                <dd className="text-sm font-semibold text-ink">
                  {payment.datePaid}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-sm text-muted">Proof of payment</dt>
                <dd className="max-w-[55%] truncate text-sm font-semibold text-ink">
                  {payment.fileName}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ privacy */}
      <p className="text-[13px] leading-relaxed text-muted">
        By submitting, you agree that the information above is used for
        registration, event communication, breakout session assignment, and
        participant care for the {EVENT.name}. Access is limited to authorized
        organizers.
      </p>
    </div>
  );
}
