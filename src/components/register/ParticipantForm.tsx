"use client";

import { useEffect } from "react";
import {
  breakoutTitle,
  openBreakoutSessions,
  EVENT,
  GENDERS,
  MARITAL_STATUSES,
} from "@convex/shared";
import { ChoiceCard, Field, SelectInput, TextInput } from "@/components/ui";
import type { ParticipantDraft, ParticipantErrors } from "@/lib/registerForm";

const GENDER_OPTIONS = GENDERS.map((value) => ({ value, label: value }));
const MARITAL_OPTIONS = MARITAL_STATUSES.map((value) => ({
  value,
  label: value,
}));

export function ParticipantForm({
  participant,
  errors,
  onChange,
  onBlurField,
  idPrefix,
  who,
  autoFocusFirst,
}: {
  participant: ParticipantDraft;
  errors: ParticipantErrors;
  onChange: (patch: Partial<ParticipantDraft>) => void;
  /** Validates a single field once the person has moved on from it. */
  onBlurField: (field: keyof ParticipantDraft) => void;
  idPrefix: string;
  /** First name if we have one, so the copy can address a person. */
  who: string;
  /** Focused when the step opens, so keyboard users start in the right place. */
  autoFocusFirst?: boolean;
}) {
  const sessions = openBreakoutSessions();
  const onlyOneSession = sessions.length === 1;

  // With a single workshop left there is nothing to choose, so it is filled in
  // rather than asked for. Done on arrival so the value is set before anyone
  // can reach the Continue button.
  useEffect(() => {
    if (!onlyOneSession) return;
    const only = String(sessions[0].value);
    if (participant.breakoutSession !== only) {
      onChange({ breakoutSession: only });
    }
  }, [onlyOneSession, sessions, participant.breakoutSession, onChange]);

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Full name"
          autoFocus={autoFocusFirst}
          value={participant.fullName}
          error={errors.fullName}
          autoComplete="off"
          placeholder="Juan Dela Cruz"
          onChange={(e) => onChange({ fullName: e.target.value })}
          onBlur={() => onBlurField("fullName")}
        />
        <TextInput
          label="Nickname"
          optional
          value={participant.preferredName}
          error={errors.preferredName}
          placeholder="What we'll put on the name tag"
          onChange={(e) => onChange({ preferredName: e.target.value })}
          onBlur={() => onBlurField("preferredName")}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-[120px_1fr_1fr]">
        <TextInput
          label="Age"
          type="number"
          inputMode="numeric"
          min={EVENT.minAge}
          max={120}
          className="no-spinner"
          value={participant.age}
          error={errors.age}
          placeholder={String(EVENT.minAge)}
          onChange={(e) => onChange({ age: e.target.value })}
          onBlur={() => onBlurField("age")}
        />
        <SelectInput
          label="Gender"
          options={GENDER_OPTIONS}
          value={participant.gender}
          error={errors.gender}
          onChange={(e) => onChange({ gender: e.target.value })}
          onBlur={() => onBlurField("gender")}
        />
        <SelectInput
          label="Marital status"
          options={MARITAL_OPTIONS}
          value={participant.maritalStatus}
          error={errors.maritalStatus}
          onChange={(e) => onChange({ maritalStatus: e.target.value })}
          onBlur={() => onBlurField("maritalStatus")}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Church or organization"
          value={participant.churchOrganization}
          error={errors.churchOrganization}
          placeholder="Grace Christian Fellowship"
          onChange={(e) => onChange({ churchOrganization: e.target.value })}
          onBlur={() => onBlurField("churchOrganization")}
        />
        <TextInput
          label="How they serve there"
          value={participant.ministryInvolvement}
          error={errors.ministryInvolvement}
          placeholder="Youth worship team"
          onChange={(e) => onChange({ ministryInvolvement: e.target.value })}
          onBlur={() => onBlurField("ministryInvolvement")}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Work or study"
          value={participant.occupation}
          error={errors.occupation}
          placeholder="Teacher, student, business"
          onChange={(e) => onChange({ occupation: e.target.value })}
          onBlur={() => onBlurField("occupation")}
        />
        <TextInput
          label="City or town"
          value={participant.cityMunicipality}
          error={errors.cityMunicipality}
          placeholder="Las Piñas"
          onChange={(e) => onChange({ cityMunicipality: e.target.value })}
          onBlur={() => onBlurField("cityMunicipality")}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Mobile number"
          type="tel"
          inputMode="tel"
          value={participant.mobileNumber}
          error={errors.mobileNumber}
          placeholder="0917 123 4567"
          onChange={(e) => onChange({ mobileNumber: e.target.value })}
          onBlur={() => onBlurField("mobileNumber")}
        />
        <TextInput
          label="Email"
          type="email"
          inputMode="email"
          value={participant.email}
          error={errors.email}
          placeholder="name@email.com"
          onChange={(e) => onChange({ email: e.target.value })}
          onBlur={() => onBlurField("email")}
        />
      </div>

      <fieldset className="flex flex-col gap-3 border-t border-line pt-6">
        <legend className="flex flex-col gap-1 pb-1">
          <span className="font-display text-[18px] leading-tight font-semibold tracking-[-0.015em] text-ink">
            {onlyOneSession
              ? `${who} will join the plenary workshop`
              : `Which session will ${who} join?`}
          </span>
          <span className="text-[14px] leading-normal text-muted">
            {onlyOneSession
              ? "Puno na po ang ibang workshops, kaya lahat ng bagong registrants ay sasama sa plenary."
              : "Pick one. You can change it any time before you're done."}
          </span>
        </legend>
        {errors.breakoutSession && (
          <p className="text-[12.5px] font-medium text-red-600">
            {errors.breakoutSession}
          </p>
        )}
        {onlyOneSession ? (
          // One workshop left, so this is news rather than a decision. Shown
          // as a statement; the value is set for them on arrival.
          <p className="rounded-xl border border-line bg-surface px-4 py-3.5 text-[15px] font-medium text-ink">
            {breakoutTitle(sessions[0].value)}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((session) => (
              <ChoiceCard
                key={session.value}
                name={`${idPrefix}-breakout`}
                align="center"
                selected={participant.breakoutSession === String(session.value)}
                onSelect={() =>
                  onChange({ breakoutSession: String(session.value) })
                }
                title={session.title}
              />
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
