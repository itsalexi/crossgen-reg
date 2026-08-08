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
import { useEffect, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  calculateTotal,
  EVENT,
  formatPeso,
  GROUP_RATE,
  GROUP_THRESHOLD,
  isExempt,
  MAX_PARTICIPANTS,
  ordinal,
  REGISTRATION_TYPES,
  spellCount,
  titleCaseCount,
  type RegistrationType,
} from "@convex/shared";
import { AccountBar, BottomBar, TopBar } from "@/components/brand";
import {
  Button,
  Callout,
  ChoiceCard,
  Eyebrow,
  Spinner,
  TextInput,
  cn,
} from "@/components/ui";
import {
  emptyParticipant,
  emptyPayment,
  firstName,
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

type Step = "type" | "people" | "payment" | "review";

const STEP_TITLES: Record<Step, string> = {
  type: "Who's coming",
  people: "Their details",
  payment: "Payment",
  review: "One last look",
};

function stepsFor(type: RegistrationType): Step[] {
  return isExempt(type)
    ? ["type", "people", "review"]
    : ["type", "people", "payment", "review"];
}

// ------------------------------------------------------------- sign-in gate

function SignInScreen() {
  const { signIn } = useAuthActions();
  const [pending, setPending] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-start gap-5 px-5 py-16 sm:py-24">
      <h1 className="font-display text-[30px] leading-tight font-semibold text-ink">
        First, tell us who you are
      </h1>
      <p className="text-[15px] leading-relaxed text-muted">
        Sign in with Google so we know who to send the confirmation to. You can
        register your whole family from one account.
      </p>
      <Button
        size="lg"
        loading={pending}
        onClick={() => {
          setPending(true);
          void signIn("google").catch(() => setPending(false));
        }}
      >
        {!pending && (
          <svg viewBox="0 0 18 18" className="size-[18px]" aria-hidden="true">
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
    </div>
  );
}

// -------------------------------------------------------------- step header

function StepHeader({
  index,
  total,
  detail,
}: {
  index: number;
  total: number;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-5 py-3.5 sm:px-10 sm:py-4">
      <span className="flex-none rounded-full bg-cg-purple-tint px-3 py-1.5 text-[13px] font-semibold text-cg-purple">
        Step {index + 1} of {total}
      </span>
      <span className="hidden truncate text-[14px] font-medium text-muted sm:block">
        {detail}
      </span>
      <div className="ml-2 h-1 flex-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-1 rounded-full bg-cg-purple-soft transition-[width] duration-300"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

/** The 300px explanatory column the design puts to the left of every step. */
function StepAside({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-6">
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-[26px] leading-[1.15] font-semibold text-ink sm:text-[30px]">
          {title}
        </h1>
        {blurb && (
          <p className="text-[15px] leading-relaxed text-muted text-pretty">
            {blurb}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

// ----------------------------------------------------------------- the flow

export function RegisterFlow() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const submitRegistration = useMutation(api.registrations.submit);

  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const [registrationType, setRegistrationType] =
    useState<RegistrationType>("regular");
  const [groupName, setGroupName] = useState("");
  const [participants, setParticipants] = useState<ParticipantDraft[]>([
    emptyParticipant(),
  ]);
  const [payment, setPayment] = useState<PaymentDraft>(emptyPayment());

  const [step, setStep] = useState<Step>("type");
  const [active, setActive] = useState(0);
  const [participantErrors, setParticipantErrors] = useState<ParticipantErrors[]>([{}]);
  const [paymentErrors, setPaymentErrors] = useState<PaymentErrors>({});
  const [groupNameError, setGroupNameError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const steps = stepsFor(registrationType);
  const stepIndex = steps.indexOf(step);
  const exempt = isExempt(registrationType);
  const count = participants.length;
  const total = calculateTotal(registrationType, count);
  const topRef = useRef<HTMLDivElement>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    if (prefilled.current || me == null) return;
    prefilled.current = true;
    setParticipants((current) => {
      const [first, ...rest] = current;
      if (first.fullName.length > 0 || first.email.length > 0) return current;
      return [{ ...first, fullName: me.name, email: me.email }, ...rest];
    });
  }, [me]);

  function scrollTop() {
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function goTo(next: Step) {
    setStep(next);
    setSubmitError(null);
    scrollTop();
  }

  function patchParticipant(index: number, patch: Partial<ParticipantDraft>) {
    setParticipants((current) =>
      current.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );
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

  /** Validate one field on blur so mistakes surface where they were made. */
  function validateField(index: number, field: keyof ParticipantDraft) {
    const found = validateParticipant(participants[index])[field];
    setParticipantErrors((current) =>
      current.map((errors, i) => {
        if (i !== index) return errors;
        const next = { ...errors };
        if (found === undefined) delete next[field];
        else next[field] = found;
        return next;
      }),
    );
  }

  function setCount(next: number) {
    const clamped = Math.max(1, Math.min(MAX_PARTICIPANTS, next));

    setParticipants((current) => {
      if (clamped === current.length) return current;
      if (clamped < current.length) return current.slice(0, clamped);
      // Most families share a church and a city. Carry those over so the
      // second through fifth person are half-filled before anyone starts.
      const seed = {
        churchOrganization: current[0].churchOrganization,
        cityMunicipality: current[0].cityMunicipality,
      };
      return [
        ...current,
        ...Array.from({ length: clamped - current.length }, () => ({
          ...emptyParticipant(),
          ...seed,
        })),
      ];
    });

    setParticipantErrors((current) =>
      clamped < current.length
        ? current.slice(0, clamped)
        : [
            ...current,
            ...Array.from({ length: clamped - current.length }, () => ({})),
          ],
    );
    setActive((index) => Math.min(index, clamped - 1));
  }

  function leaveTypeStep() {
    if (count > 1 && groupName.trim().length === 0) {
      setGroupNameError("Give the group a name so organizers can find you.");
      return;
    }
    goTo("people");
  }

  function advanceFromPerson() {
    const errors = validateParticipant(participants[active]);
    if (Object.keys(errors).length > 0) {
      setParticipantErrors((current) =>
        current.map((e, i) => (i === active ? errors : e)),
      );
      scrollTop();
      return;
    }
    if (active < count - 1) {
      setActive(active + 1);
      scrollTop();
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
    const allErrors = participants.map(validateParticipant);
    const broken = allErrors.findIndex((e) => Object.keys(e).length > 0);
    if (broken !== -1) {
      setParticipantErrors(allErrors);
      setActive(broken);
      goTo("people");
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
          : "Something went wrong sending this in. Please try again.",
      );
      setSubmitting(false);
    }
  }

  const activeName = firstName(participants[active]) || "this person";
  const doneCount = participants.filter(participantIsComplete).length;

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar right={<AccountBar />} />

      <AuthLoading>
        <div className="flex flex-1 items-center justify-center py-24">
          <Spinner className="size-6 text-cg-purple" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <main className="flex-1">
          <SignInScreen />
        </main>
      </Unauthenticated>

      <Authenticated>
        <StepHeader
          index={stepIndex}
          total={steps.length}
          detail={
            step === "people" && count > 1
              ? `${activeName}, ${ordinal(active + 1)} of ${spellCount(count)}`
              : STEP_TITLES[step]
          }
        />

        <main ref={topRef} className="flex-1 scroll-mt-4">
          {/* ------------------------------------------------------- type */}
          {step === "type" && (
            <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-5 py-10 sm:px-10 sm:py-12 lg:grid-cols-[300px_1fr] lg:gap-16">
              <StepAside
                title="Who's coming with you?"
                blurb="Register everyone at once and we'll keep them together. If someone is serving or speaking, they can register separately."
              />

              <form
                noValidate
                className="flex max-w-[640px] flex-col gap-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  leaveTypeStep();
                }}
              >
                {REGISTRATION_TYPES.map((option) => (
                  <ChoiceCard
                    key={option.value}
                    name="registration-type"
                    selected={registrationType === option.value}
                    onSelect={() => setRegistrationType(option.value)}
                    title={option.label}
                    blurb={option.blurb}
                  />
                ))}

                <div className="mt-5 grid gap-5 border-t border-line pt-6 sm:grid-cols-[180px_1fr]">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-ink">
                      How many of you?
                    </span>
                    <div className="flex h-12 w-fit items-center gap-1 rounded-xl border border-line p-1 sm:h-11">
                      <button
                        type="button"
                        aria-label="One fewer person"
                        disabled={count <= 1}
                        onClick={() => setCount(count - 1)}
                        className="flex size-9 items-center justify-center rounded-lg text-lg font-semibold text-cg-purple hover:bg-cg-purple-tint disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        −
                      </button>
                      <span className="w-10 text-center font-display text-lg font-bold text-ink">
                        {count}
                      </span>
                      <button
                        type="button"
                        aria-label="One more person"
                        disabled={count >= MAX_PARTICIPANTS}
                        onClick={() => setCount(count + 1)}
                        className="flex size-9 items-center justify-center rounded-lg text-lg font-semibold text-cg-purple hover:bg-cg-purple-tint disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {count > 1 && (
                    <TextInput
                      label="What should we call your group?"
                      value={groupName}
                      error={groupNameError}
                      placeholder="Canamo Family"
                      onChange={(e) => {
                        setGroupName(e.target.value);
                        setGroupNameError(undefined);
                      }}
                    />
                  )}
                </div>

                {!exempt && count >= GROUP_THRESHOLD && (
                  <div className="mt-4">
                    <Callout tone="gold" title="You're getting the group rate">
                      {titleCaseCount(count)} of you at {formatPeso(GROUP_RATE)}{" "}
                      each — {formatPeso(total)} altogether, instead of{" "}
                      {formatPeso(450)} each.
                    </Callout>
                  </div>
                )}

                {!exempt && count === GROUP_THRESHOLD - 1 && (
                  <div className="mt-4">
                    <Callout tone="gold" title="One more and the price drops">
                      Add a fifth person and everyone pays{" "}
                      {formatPeso(GROUP_RATE)} instead of {formatPeso(450)} —{" "}
                      {formatPeso(GROUP_RATE * GROUP_THRESHOLD)} for five,
                      against {formatPeso(total)} for four.
                    </Callout>
                  </div>
                )}

                {exempt && (
                  <div className="mt-4">
                    <Callout tone="teal">
                      Nothing to pay for this kind of registration — we&rsquo;ll
                      skip straight past the payment step.
                    </Callout>
                  </div>
                )}

                <div className="mt-6 flex items-center gap-4">
                  <Button type="submit">Continue</Button>
                </div>
              </form>
            </div>
          )}

          {/* ----------------------------------------------------- people */}
          {step === "people" && (
            <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-5 py-10 sm:px-10 sm:py-12 lg:grid-cols-[300px_1fr] lg:gap-16">
              <StepAside
                title={
                  count === 1
                    ? "Tell us about yourself"
                    : `Tell us about ${activeName}`
                }
                blurb={
                  count > 1 && active > 0
                    ? "We've carried over the church and city from the first person. Change them if they're different."
                    : "This is what the organizers will use to prepare for the day."
                }
              >
                {count > 1 && (
                  <nav
                    aria-label="People in this registration"
                    className="flex flex-col gap-0.5 border-t border-line pt-3.5"
                  >
                    {participants.map((participant, index) => {
                      const isActive = index === active;
                      const done = participantIsComplete(participant);
                      const name =
                        participant.fullName.trim() ||
                        `${ordinal(index + 1).replace(/^./, (c) => c.toUpperCase())} person`;

                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setActive(index);
                            scrollTop();
                          }}
                          aria-current={isActive ? "step" : undefined}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-left text-[14px] transition-colors",
                            isActive
                              ? "bg-cg-purple-tint font-semibold text-cg-purple"
                              : "font-medium text-ink hover:bg-surface",
                          )}
                        >
                          <span className="truncate">{name}</span>
                          {isActive ? (
                            <span className="flex-none text-[13px]">Now</span>
                          ) : done ? (
                            <span className="flex-none text-[13px] font-semibold text-pcec-teal">
                              Done
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </nav>
                )}

                {!exempt && (
                  <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3.5">
                    <span className="text-[13.5px] text-muted">
                      {count > 1 ? `${titleCaseCount(count)} of you` : "Just you"}
                      {count >= GROUP_THRESHOLD ? ", group rate" : ""}
                    </span>
                    <span className="font-display text-[16px] font-bold text-ink">
                      {formatPeso(total)}
                    </span>
                  </div>
                )}
              </StepAside>

              <form
                noValidate
                className="flex max-w-[720px] flex-col gap-7"
                onSubmit={(e) => {
                  e.preventDefault();
                  advanceFromPerson();
                }}
              >
                {participantErrors[active]?.age?.startsWith(String(EVENT.minAge)) && (
                  <Callout tone="gold" title="This one is 14 and above">
                    Pasensya na po — walang mapaglalagakan ng mga mumunting bata
                    sa venue, kaya {EVENT.minAge} pataas lang ang pwedeng
                    sumama.
                  </Callout>
                )}

                <ParticipantForm
                  key={active}
                  participant={participants[active]}
                  errors={participantErrors[active] ?? {}}
                  idPrefix={`p${active}`}
                  who={count === 1 ? "you" : activeName}
                  autoFocusFirst={count > 1}
                  onChange={(patch) => patchParticipant(active, patch)}
                  onBlurField={(field) => validateField(active, field)}
                />

                <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-3 border-t border-line bg-white/95 px-5 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-1 sm:pb-0 sm:backdrop-blur-none">
                  <Button type="submit">
                    {active < count - 1
                      ? "Next person"
                      : exempt
                        ? "One last look"
                        : "On to payment"}
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => {
                      if (active > 0) {
                        setActive(active - 1);
                        scrollTop();
                      } else {
                        goTo("type");
                      }
                    }}
                  >
                    Back
                  </Button>
                  {count > 1 && (
                    <span className="ml-auto text-[13px] text-muted">
                      {doneCount} of {count} saved
                    </span>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* ---------------------------------------------------- payment */}
          {step === "payment" && (
            <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-5 py-10 sm:px-10 sm:py-12 lg:grid-cols-[300px_1fr] lg:gap-16">
              <StepAside
                title="Send it over, then show us the receipt"
                blurb="Deposit to the account below, then attach a photo of the slip so the team can tick your group off the list."
              />
              <form
                noValidate
                className="flex max-w-[720px] flex-col gap-7"
                onSubmit={(e) => {
                  e.preventDefault();
                  advanceFromPayment();
                }}
              >
                <PaymentStep
                  payment={payment}
                  errors={paymentErrors}
                  participantCount={count}
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
                <div className="sticky bottom-0 -mx-5 flex items-center gap-3 border-t border-line bg-white/95 px-5 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
                  <Button type="submit">Continue</Button>
                  <Button type="button" variant="quiet" onClick={() => goTo("people")}>
                    Back
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* ----------------------------------------------------- review */}
          {step === "review" && (
            <div className="mx-auto w-full max-w-[820px] px-5 py-10 sm:px-9 sm:py-12">
              <ReviewStep
                registrationType={registrationType}
                groupName={groupName}
                participants={participants}
                payment={payment}
                total={total}
                onEditType={() => goTo("type")}
                onEditParticipant={(index) => {
                  setActive(index);
                  goTo("people");
                }}
                onEditPayment={() => goTo("payment")}
              />

              {submitError !== null && (
                <div className="mt-6">
                  <Callout tone="error" title="That didn't go through">
                    {submitError}
                  </Callout>
                </div>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button size="lg" loading={submitting} onClick={() => void handleSubmit()}>
                  Send it in
                </Button>
                <span className="text-[13.5px] text-muted">
                  We&rsquo;ll email you a copy right away.
                </span>
                <Button
                  variant="quiet"
                  disabled={submitting}
                  onClick={() => goTo(exempt ? "people" : "payment")}
                >
                  Back
                </Button>
              </div>
            </div>
          )}
        </main>
      </Authenticated>

      <BottomBar />
    </div>
  );
}
