"use client";

import {
  BREAKOUT_SESSIONS,
  EVENT,
  GENDERS,
  MARITAL_STATUSES,
} from "@convex/shared";
import type {
  ParticipantDraft,
  ParticipantErrors,
} from "@/lib/registerForm";
import { Field, SelectInput, TextInput, cn } from "@/components/ui";

const GENDER_OPTIONS = GENDERS.map((value) => ({ value, label: value }));
const MARITAL_OPTIONS = MARITAL_STATUSES.map((value) => ({
  value,
  label: value,
}));

export function ParticipantForm({
  participant,
  errors,
  onChange,
  idPrefix,
}: {
  participant: ParticipantDraft;
  errors: ParticipantErrors;
  onChange: (patch: Partial<ParticipantDraft>) => void;
  idPrefix: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Full name"
          value={participant.fullName}
          error={errors.fullName}
          autoComplete="off"
          placeholder="Juan Dela Cruz"
          onChange={(e) => onChange({ fullName: e.target.value })}
        />
        <TextInput
          label="Preferred name"
          optional
          value={participant.preferredName}
          error={errors.preferredName}
          placeholder="What should we call you?"
          onChange={(e) => onChange({ preferredName: e.target.value })}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
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
        />
        <SelectInput
          label="Gender"
          options={GENDER_OPTIONS}
          value={participant.gender}
          error={errors.gender}
          onChange={(e) => onChange({ gender: e.target.value })}
        />
        <SelectInput
          label="Marital status"
          options={MARITAL_OPTIONS}
          value={participant.maritalStatus}
          error={errors.maritalStatus}
          onChange={(e) => onChange({ maritalStatus: e.target.value })}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Church / organization"
          value={participant.churchOrganization}
          error={errors.churchOrganization}
          placeholder="Your local church or organization"
          onChange={(e) => onChange({ churchOrganization: e.target.value })}
        />
        <TextInput
          label="Ministry involvement in church"
          value={participant.ministryInvolvement}
          error={errors.ministryInvolvement}
          placeholder="e.g. Youth, Music, None yet"
          onChange={(e) => onChange({ ministryInvolvement: e.target.value })}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Occupation"
          value={participant.occupation}
          error={errors.occupation}
          placeholder="e.g. Teacher, Student"
          onChange={(e) => onChange({ occupation: e.target.value })}
        />
        <TextInput
          label="City / municipality"
          value={participant.cityMunicipality}
          error={errors.cityMunicipality}
          placeholder="e.g. Las Piñas"
          onChange={(e) => onChange({ cityMunicipality: e.target.value })}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Mobile number"
          type="tel"
          inputMode="tel"
          value={participant.mobileNumber}
          error={errors.mobileNumber}
          placeholder="09XX XXX XXXX"
          onChange={(e) => onChange({ mobileNumber: e.target.value })}
        />
        <TextInput
          label="Email address"
          type="email"
          inputMode="email"
          value={participant.email}
          error={errors.email}
          placeholder="name@email.com"
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </div>

      <Field label="Breakout session" error={errors.breakoutSession}>
        <div
          role="radiogroup"
          aria-label="Breakout session"
          className="flex flex-col gap-2"
        >
          {BREAKOUT_SESSIONS.map((session) => {
            const id = `${idPrefix}-breakout-${session.value}`;
            const selected = participant.breakoutSession === String(session.value);

            return (
              <label
                key={session.value}
                htmlFor={id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
                  selected
                    ? "border-cg-purple bg-cg-purple-tint"
                    : "border-line bg-white hover:border-cg-purple-soft/50 hover:bg-surface",
                )}
              >
                <input
                  id={id}
                  type="radio"
                  name={`${idPrefix}-breakout`}
                  className="sr-only"
                  checked={selected}
                  onChange={() =>
                    onChange({ breakoutSession: String(session.value) })
                  }
                />
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    selected ? "border-cg-purple" : "border-line",
                  )}
                  aria-hidden="true"
                >
                  {selected && (
                    <span className="size-2.5 rounded-full bg-cg-purple" />
                  )}
                </span>
                <span className="text-[14.5px] leading-relaxed text-ink">
                  <span className="mr-1.5 font-semibold text-cg-purple">
                    {session.value}.
                  </span>
                  {session.title}
                </span>
              </label>
            );
          })}
        </div>
      </Field>
    </div>
  );
}
