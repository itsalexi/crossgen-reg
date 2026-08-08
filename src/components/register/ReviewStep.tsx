"use client";

import {
  breakoutTitle,
  formatPeso,
  GROUP_THRESHOLD,
  isExempt,
  ratePerPerson,
  spellCount,
  titleCaseCount,
  typeShort,
  type RegistrationType,
} from "@convex/shared";
import { Eyebrow } from "@/components/ui";
import type { ParticipantDraft, PaymentDraft } from "@/lib/registerForm";

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[13.5px] font-semibold text-cg-purple underline-offset-2 hover:underline"
    >
      Edit
    </button>
  );
}

function SectionHead({
  label,
  onEdit,
}: {
  label: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 pb-2.5">
      <Eyebrow>{label}</Eyebrow>
      <EditButton onClick={onEdit} />
    </div>
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
  const count = participants.length;
  const rate = ratePerPerson(count);
  const grouped = count >= GROUP_THRESHOLD;

  const heading =
    groupName.trim().length > 0
      ? groupName.trim()
      : participants[0].fullName.trim() || "Your registration";

  const subtitle = exempt
    ? `${titleCaseCount(count)} ${count === 1 ? "person" : "people"}, ${typeShort(registrationType).toLowerCase()}`
    : count === 1
      ? "Just you, joining as a guest"
      : `${titleCaseCount(count)} of you, joining as guests`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[26px] leading-tight font-semibold text-ink sm:text-[30px]">
            {heading}
          </h1>
          <span className="text-[15px] text-muted">{subtitle}</span>
        </div>
        <EditButton onClick={onEditType} />
      </div>

      {/* ------------------------------------------------------- everyone */}
      <section className="flex flex-col">
        <SectionHead
          label={count === 1 ? "Your details" : "Everyone in your group"}
          onEdit={() => onEditParticipant(0)}
        />
        {participants.map((participant, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onEditParticipant(index)}
            className="flex flex-col gap-1 border-t border-line py-3 text-left last:border-b hover:bg-surface sm:flex-row sm:justify-between sm:gap-5"
          >
            <span className="text-[15px] leading-snug font-medium text-ink">
              {participant.fullName.trim()}
            </span>
            <span className="max-w-[46ch] text-[13.5px] leading-snug text-muted sm:text-right sm:text-[14px]">
              {breakoutTitle(Number(participant.breakoutSession))}
            </span>
          </button>
        ))}
      </section>

      {/* -------------------------------------------------------- payment */}
      <section className="flex flex-col">
        <SectionHead label="Payment" onEdit={exempt ? onEditType : onEditPayment} />

        {exempt ? (
          <div className="flex items-baseline justify-between gap-5 border-t border-line py-3">
            <span className="text-[14.5px] text-muted">
              Nothing to pay for a {typeShort(registrationType).toLowerCase()}{" "}
              registration
            </span>
            <span className="font-display text-[20px] font-bold text-ink">
              {formatPeso(0)}
            </span>
          </div>
        ) : (
          <>
            <div className="flex justify-between gap-5 border-t border-line py-3">
              <span className="text-[14.5px] text-muted">Rate</span>
              <span className="text-[14.5px] font-medium text-ink">
                {formatPeso(rate)} each{grouped ? ", group rate" : ""}
              </span>
            </div>
            <div className="flex justify-between gap-5 border-t border-line py-3">
              <span className="text-[14.5px] text-muted">Reference</span>
              <span className="text-[14.5px] font-medium text-ink">
                {payment.paymentReference}
                {payment.datePaid && ` · paid ${payment.datePaid}`}
              </span>
            </div>
            <div className="flex justify-between gap-5 border-t border-line py-3">
              <span className="text-[14.5px] text-muted">Receipt</span>
              <span className="max-w-[24ch] truncate text-[14.5px] font-medium text-ink">
                {payment.fileName}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-5 border-t-[1.5px] border-ink pt-4">
              <span className="font-display text-[16px] font-semibold text-ink">
                Total
              </span>
              <span className="font-display text-[26px] leading-none font-bold tracking-[-0.02em] text-ink">
                {formatPeso(total)}
              </span>
            </div>
          </>
        )}
      </section>

      <p className="text-[13px] leading-relaxed text-muted">
        Sending this in shares {spellCount(count)}{" "}
        {count === 1 ? "person's" : "people's"} details with the CrossGen
        organizing team, for registration, event updates, session assignment,
        and looking after everyone on the day.
      </p>
    </div>
  );
}
