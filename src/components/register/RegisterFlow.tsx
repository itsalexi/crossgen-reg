"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import { ConvexError } from "convex/values";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  calculateTotal,
  EVENT,
  formatPeso,
  GROUP_THRESHOLD,
  isExempt,
  MAX_PARTICIPANTS,
  REGISTRATION_TYPES,
  type RegistrationType,
} from "@convex/shared";
import {
  Button,
  Callout,
  Card,
  SectionLabel,
  Spinner,
  TextInput,
  cn,
} from "@/components/ui";
import {
  displayName,
  emptyParticipant,
  emptyPayment,
  participantIsComplete,
  validateParticipant,
  validatePayment,
  type ParticipantDraft,
  type ParticipantErrors,
  type PaymentDraft,
  type PaymentErrors,
} from "@/lib/registerForm";
import { ParticipantForm } from "./ParticipantForm";
import { PaymentStep } from "./PaymentStep";
import { ReviewStep } from "./ReviewStep";

type Step = "type" | "participants" | "payment" | "review";

function stepsFor(type: RegistrationType): Step[] {
  return isExempt(type)
    ? ["type", "participants", "review"]
    : ["type", "participants", "payment", "review"];
}

const STEP_LABELS: Record<Step, string> = {
  type: "Type",
  participants: "Participants",
  payment: "Payment",
  review: "Review",
};

// --------------------------------------------------------------- chrome bits

function StepBar({ steps, current }: { steps: Step[]; current: Step }) {
  const currentIndex = steps.indexOf(current);

  return (
    <ol className="flex items-center gap-2" aria-label="Registration progress">
      {steps.map((step, index) => {
        const state =
          index < currentIndex ? "done" : index === currentIndex ? "now" : "todo";

        return (
          <li key={step} className="flex flex-1 items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span
                className={cn(
                  "h-1 rounded-full transition-colors",
                  state === "todo" ? "bg-line" : "bg-cg-gold",
                )}
              />
              <span
                className={cn(
                  "truncate text-[12px] font-semibold",
                  state === "now"
                    ? "text-ink"
                    : state === "done"
                      ? "text-muted"
                      : "text-muted/60",
                )}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function SignInPanel() {
  const { signIn } = useAuthActions();
  const [pending, setPending] = useState(false);

  return (
    <Card className="text-center">
      <h2 className="font-display text-xl font-bold text-ink">
        Sign in to register
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">
        We use your Google account to identify you as the registrant and to send
        your confirmation email.
      </p>
      <Button
        className="mt-6"
        size="lg"
        loading={pending}
        onClick={() => {
          setPending(true);
          void signIn("google").catch(() => setPending(false));
        }}
      >
        {!pending && (
          <svg viewBox="0 0 18 18" className="size-4.5" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
            />
            <path
              fill="#FBBC05"
              d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.32Z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58Z"
            />
          </svg>
        )}
        Continue with Google
      </Button>
    </Card>
  );
}

// ----------------------------------------------------------------- the flow

export function RegisterFlow() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const submitRegistration = useMutation(api.registrations.submit);

  // Generated once per mounted form. Makes a retried submit return the original
  // registration instead of creating a second one.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const [registrationType, setRegistrationType] =
    useState<RegistrationType>("regular");
  const [groupName, setGroupName] = useState("");
  const [participants, setParticipants] = useState<ParticipantDraft[]>([
    emptyParticipant(),
  ]);
  const [payment, setPayment] = useState<PaymentDraft>(emptyPayment());

  const [step, setStep] = useState<Step>("type");
  const [activeParticipant, setActiveParticipant] = useState(0);
  const [participantErrors, setParticipantErrors] = useState<ParticipantErrors[]>(
    [{}],
  );
  const [paymentErrors, setPaymentErrors] = useState<PaymentErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const steps = stepsFor(registrationType);
  const exempt = isExempt(registrationType);
  const total = calculateTotal(registrationType, participants.length);
  const topRef = useRef<HTMLDivElement>(null);
  const prefilled = useRef(false);

  // Prefill the first participant from the Google account, once. Later edits
  // by the user are never overwritten.
  useEffect(() => {
    if (prefilled.current || me == null) return;
    prefilled.current = true;
    setParticipants((current) => {
      const [first, ...rest] = current;
      if (first.fullName.length > 0 || first.email.length > 0) return current;
      return [{ ...first, fullName: me.name, email: me.email }, ...rest];
    });
  }, [me]);

  function goTo(next: Step) {
    setStep(next);
    setSubmitError(null);
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function patchParticipant(index: number, patch: Partial<ParticipantDraft>) {
    setParticipants((current) =>
      current.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );
    // Clear only the fields being edited, so untouched errors stay visible.
    setParticipantErrors((current) =>
      current.map((errors, i) => {
        if (i !== index) return errors;
        const next = { ...errors };
        for (const key of Object.keys(patch) as (keyof ParticipantDraft)[]) {
          delete next[key];
        }
        return next;
      }),
    );
  }

  function setParticipantCount(count: number) {
    const clamped = Math.max(1, Math.min(MAX_PARTICIPANTS, count));
    setParticipants((current) => {
      if (clamped === current.length) return current;
      if (clamped < current.length) return current.slice(0, clamped);
      return [
        ...current,
        ...Array.from({ length: clamped - current.length }, emptyParticipant),
      ];
    });
    setParticipantErrors((current) => {
      if (clamped === current.length) return current;
      if (clamped < current.length) return current.slice(0, clamped);
      return [
        ...current,
        ...Array.from({ length: clamped - current.length }, () => ({})),
      ];
    });
    setActiveParticipant((index) => Math.min(index, clamped - 1));
  }

  function advanceFromParticipant() {
    const errors = validateParticipant(participants[activeParticipant]);
    if (Object.keys(errors).length > 0) {
      setParticipantErrors((current) =>
        current.map((e, i) => (i === activeParticipant ? errors : e)),
      );
      topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }

    if (activeParticipant < participants.length - 1) {
      setActiveParticipant(activeParticipant + 1);
      topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }

    goTo(exempt ? "review" : "payment");
  }

  function advanceFromPayment() {
    const errors = validatePayment(payment);
    if (Object.keys(errors).length > 0) {
      setPaymentErrors(errors);
      return;
    }
    goTo("review");
  }

  async function handleSubmit() {
    // Re-validate everything: a user can reach review, go back, break a field,
    // and jump forward again.
    const allErrors = participants.map(validateParticipant);
    const firstBroken = allErrors.findIndex((e) => Object.keys(e).length > 0);
    if (firstBroken !== -1) {
      setParticipantErrors(allErrors);
      setActiveParticipant(firstBroken);
      goTo("participants");
      return;
    }

    if (!exempt) {
      const errors = validatePayment(payment);
      if (Object.keys(errors).length > 0) {
        setPaymentErrors(errors);
        goTo("payment");
        return;
      }
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitRegistration({
        idempotencyKey,
        groupName: groupName.trim().length > 0 ? groupName.trim() : undefined,
        registrationType,
        participants: participants.map((p) => ({
          fullName: p.fullName.trim(),
          preferredName:
            p.preferredName.trim().length > 0 ? p.preferredName.trim() : undefined,
          age: Number(p.age),
          gender: p.gender,
          maritalStatus: p.maritalStatus,
          churchOrganization: p.churchOrganization.trim(),
          ministryInvolvement: p.ministryInvolvement.trim(),
          occupation: p.occupation.trim(),
          mobileNumber: p.mobileNumber.trim(),
          email: p.email.trim(),
          cityMunicipality: p.cityMunicipality.trim(),
          breakoutSession: Number(p.breakoutSession) as 1 | 2 | 3 | 4 | 5,
        })),
        payment:
          exempt || payment.storageId === null
            ? undefined
            : {
                paymentReference: payment.paymentReference.trim(),
                datePaid: payment.datePaid,
                storageId: payment.storageId as Id<"_storage">,
                fileName: payment.fileName,
              },
      });

      router.push(`/registration/${result.registrationId}`);
    } catch (error) {
      setSubmitError(
        error instanceof ConvexError
          ? String(error.data)
          : "Something went wrong submitting your registration. Please try again.",
      );
      setSubmitting(false);
    }
  }

  const completedCount = useMemo(
    () => participants.filter(participantIsComplete).length,
    [participants],
  );

  return (
    <div ref={topRef} className="mx-auto w-full max-w-2xl scroll-mt-24 px-5 py-10">
      <AuthLoading>
        <div className="flex justify-center py-20">
          <Spinner className="size-6 text-cg-purple" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <SignInPanel />
      </Unauthenticated>

      <Authenticated>
        <StepBar steps={steps} current={step} />

        <div className="mt-8">
          {/* ------------------------------------------------------- type */}
          {step === "type" && (
            <div className="flex flex-col gap-7">
              <div>
                <h1 className="font-display text-2xl font-bold text-ink">
                  What kind of registration is this?
                </h1>
                <p className="mt-1.5 text-[15px] text-muted">
                  One type per registration — everyone you add here shares it.
                </p>
              </div>

              <div
                role="radiogroup"
                aria-label="Registration type"
                className="grid gap-3 sm:grid-cols-2"
              >
                {REGISTRATION_TYPES.map((option) => {
                  const selected = registrationType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setRegistrationType(option.value)}
                      className={cn(
                        "rounded-2xl border p-5 text-left transition-colors",
                        selected
                          ? "border-cg-purple bg-cg-purple-tint"
                          : "border-line bg-white hover:border-cg-purple-soft/50 hover:bg-surface",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-display font-bold text-ink">
                          {option.label}
                        </span>
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                            selected ? "border-cg-purple" : "border-line",
                          )}
                          aria-hidden="true"
                        >
                          {selected && (
                            <span className="size-2.5 rounded-full bg-cg-purple" />
                          )}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                        {option.blurb}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-line bg-white p-6">
                <SectionLabel>How many participants?</SectionLabel>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex items-center gap-1 rounded-xl border border-line p-1">
                    <button
                      type="button"
                      aria-label="Remove a participant"
                      disabled={participants.length <= 1}
                      onClick={() => setParticipantCount(participants.length - 1)}
                      className="flex size-9 items-center justify-center rounded-lg text-lg font-semibold text-cg-purple transition-colors hover:bg-cg-purple-tint disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      −
                    </button>
                    <span className="w-10 text-center font-display text-lg font-bold text-ink">
                      {participants.length}
                    </span>
                    <button
                      type="button"
                      aria-label="Add a participant"
                      disabled={participants.length >= MAX_PARTICIPANTS}
                      onClick={() => setParticipantCount(participants.length + 1)}
                      className="flex size-9 items-center justify-center rounded-lg text-lg font-semibold text-cg-purple transition-colors hover:bg-cg-purple-tint disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      +
                    </button>
                  </div>

                  {!exempt && (
                    <p className="text-[14.5px] text-muted">
                      Total:{" "}
                      <span className="font-display text-lg font-bold text-ink">
                        {formatPeso(total)}
                      </span>
                      {participants.length >= GROUP_THRESHOLD && (
                        <span className="ml-2 rounded-full bg-cg-gold-tint px-2 py-0.5 text-[11.5px] font-bold text-[#8a6800]">
                          GROUP RATE
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {!exempt && participants.length === GROUP_THRESHOLD - 1 && (
                  <p className="mt-3 text-[13px] leading-relaxed text-cg-purple">
                    Add one more participant to unlock the group rate — {formatPeso(1750)}{" "}
                    for {GROUP_THRESHOLD} instead of {formatPeso(total)} for{" "}
                    {participants.length}.
                  </p>
                )}

                {participants.length > 1 && (
                  <div className="mt-5">
                    <TextInput
                      label="Group name"
                      value={groupName}
                      placeholder="e.g. Canamo Family"
                      hint="How the organizers will see this group on their list."
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {exempt && (
                <Callout tone="info">
                  No payment is required for this registration type. You will skip
                  the payment step entirely.
                </Callout>
              )}

              <div className="flex justify-end">
                <Button
                  size="lg"
                  onClick={() => {
                    if (participants.length > 1 && groupName.trim().length === 0) {
                      return;
                    }
                    goTo("participants");
                  }}
                  disabled={participants.length > 1 && groupName.trim().length === 0}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* ----------------------------------------------- participants */}
          {step === "participants" && (
            <div className="flex flex-col gap-7">
              <div>
                <div className="flex items-baseline justify-between gap-4">
                  <h1 className="font-display text-2xl font-bold text-ink">
                    {participants.length === 1
                      ? "Your details"
                      : `Participant ${activeParticipant + 1} of ${participants.length}`}
                  </h1>
                  {participants.length > 1 && (
                    <span className="text-[13px] text-muted">
                      {completedCount}/{participants.length} complete
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[15px] text-muted">
                  Everyone attending needs their own details. Participants must be{" "}
                  {EVENT.minAge} or older.
                </p>
              </div>

              {participants.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {participants.map((participant, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setActiveParticipant(index)}
                      className={cn(
                        "max-w-[16ch] truncate rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors",
                        index === activeParticipant
                          ? "border-cg-purple bg-cg-purple text-white"
                          : participantIsComplete(participant)
                            ? "border-line bg-white text-ink hover:border-cg-purple-soft"
                            : "border-dashed border-line bg-surface text-muted hover:border-cg-purple-soft",
                      )}
                    >
                      {displayName(participant, index)}
                    </button>
                  ))}
                </div>
              )}

              <Card>
                <ParticipantForm
                  participant={participants[activeParticipant]}
                  errors={participantErrors[activeParticipant] ?? {}}
                  idPrefix={`p${activeParticipant}`}
                  onChange={(patch) => patchParticipant(activeParticipant, patch)}
                />
              </Card>

              <div className="flex items-center justify-between gap-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (activeParticipant > 0) {
                      setActiveParticipant(activeParticipant - 1);
                      topRef.current?.scrollIntoView({ block: "start" });
                    } else {
                      goTo("type");
                    }
                  }}
                >
                  Back
                </Button>
                <Button size="lg" onClick={advanceFromParticipant}>
                  {activeParticipant < participants.length - 1
                    ? "Next participant"
                    : exempt
                      ? "Review registration"
                      : "Continue to payment"}
                </Button>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- payment */}
          {step === "payment" && (
            <div className="flex flex-col gap-7">
              <div>
                <h1 className="font-display text-2xl font-bold text-ink">
                  Payment
                </h1>
                <p className="mt-1.5 text-[15px] text-muted">
                  Send the total below, then record the details of your payment.
                </p>
              </div>

              <PaymentStep
                payment={payment}
                errors={paymentErrors}
                participantCount={participants.length}
                total={total}
                onChange={(patch) => {
                  setPayment((current) => ({ ...current, ...patch }));
                  setPaymentErrors((current) => {
                    const next = { ...current };
                    for (const key of Object.keys(patch) as (keyof PaymentDraft)[]) {
                      delete next[key];
                    }
                    return next;
                  });
                }}
              />

              <div className="flex items-center justify-between gap-4">
                <Button variant="secondary" onClick={() => goTo("participants")}>
                  Back
                </Button>
                <Button size="lg" onClick={advanceFromPayment}>
                  Review registration
                </Button>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------- review */}
          {step === "review" && (
            <div className="flex flex-col gap-7">
              <div>
                <h1 className="font-display text-2xl font-bold text-ink">
                  Review your registration
                </h1>
                <p className="mt-1.5 text-[15px] text-muted">
                  Check everything below. You will get a confirmation email right
                  after you submit.
                </p>
              </div>

              <ReviewStep
                registrationType={registrationType}
                groupName={groupName}
                participants={participants}
                payment={payment}
                total={total}
                onEditType={() => goTo("type")}
                onEditParticipant={(index) => {
                  setActiveParticipant(index);
                  goTo("participants");
                }}
                onEditPayment={() => goTo("payment")}
              />

              {submitError !== null && (
                <Callout tone="error" title="Could not submit">
                  {submitError}
                </Callout>
              )}

              <div className="flex items-center justify-between gap-4">
                <Button
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => goTo(exempt ? "participants" : "payment")}
                >
                  Back
                </Button>
                <Button size="lg" loading={submitting} onClick={() => void handleSubmit()}>
                  Submit registration
                </Button>
              </div>
            </div>
          )}
        </div>
      </Authenticated>
    </div>
  );
}
