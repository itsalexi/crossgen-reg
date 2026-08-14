"use client";

import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import {
  BREAKOUT_SESSIONS,
  GENDERS,
  MARITAL_STATUSES,
} from "@convex/shared";
import {
  Button,
  Callout,
  Eyebrow,
  SelectInput,
  TextInput,
} from "@/components/ui";

type Registration = Doc<"registrations">;
type Participant = Doc<"participants">;

const GENDER_OPTIONS = GENDERS.map((value) => ({ value, label: value }));
const MARITAL_OPTIONS = MARITAL_STATUSES.map((value) => ({
  value,
  label: value,
}));
const SESSION_OPTIONS = BREAKOUT_SESSIONS.map((s) => ({
  value: s.value,
  label: `${s.value}. ${s.title}`,
}));

function ParticipantFields({
  participant,
  onDone,
}: {
  participant: Participant;
  onDone: () => void;
}) {
  const update = useMutation(api.organizer.updateParticipant);
  const [draft, setDraft] = useState({
    fullName: participant.fullName,
    preferredName: participant.preferredName ?? "",
    age: String(participant.age),
    gender: participant.gender,
    maritalStatus: participant.maritalStatus,
    churchOrganization: participant.churchOrganization,
    ministryInvolvement: participant.ministryInvolvement,
    occupation: participant.occupation,
    mobileNumber: participant.mobileNumber,
    email: participant.email,
    cityMunicipality: participant.cityMunicipality,
    breakoutSession: String(participant.breakoutSession),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<typeof draft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  return (
    <form
      noValidate
      className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        void update({
          participantId: participant._id,
          participant: {
            fullName: draft.fullName,
            preferredName: draft.preferredName || undefined,
            age: Number(draft.age),
            gender: draft.gender,
            maritalStatus: draft.maritalStatus,
            churchOrganization: draft.churchOrganization,
            ministryInvolvement: draft.ministryInvolvement,
            occupation: draft.occupation,
            mobileNumber: draft.mobileNumber,
            email: draft.email,
            cityMunicipality: draft.cityMunicipality,
            breakoutSession: Number(draft.breakoutSession) as 1 | 2 | 3 | 4 | 5,
          },
        })
          .then(onDone)
          .catch((caught) =>
            setError(
              caught instanceof ConvexError
                ? String(caught.data)
                : "Could not save those changes.",
            ),
          )
          .finally(() => setBusy(false));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Full name"
          value={draft.fullName}
          onChange={(e) => set({ fullName: e.target.value })}
        />
        <TextInput
          label="Nickname"
          optional
          value={draft.preferredName}
          onChange={(e) => set({ preferredName: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[110px_1fr_1fr]">
        <TextInput
          label="Age"
          type="number"
          className="no-spinner"
          value={draft.age}
          onChange={(e) => set({ age: e.target.value })}
        />
        <SelectInput
          label="Gender"
          options={GENDER_OPTIONS}
          value={draft.gender}
          onChange={(e) => set({ gender: e.target.value })}
        />
        <SelectInput
          label="Marital status"
          options={MARITAL_OPTIONS}
          value={draft.maritalStatus}
          onChange={(e) => set({ maritalStatus: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Church or organization"
          value={draft.churchOrganization}
          onChange={(e) => set({ churchOrganization: e.target.value })}
        />
        <TextInput
          label="How they serve there"
          value={draft.ministryInvolvement}
          onChange={(e) => set({ ministryInvolvement: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Work or study"
          value={draft.occupation}
          onChange={(e) => set({ occupation: e.target.value })}
        />
        <TextInput
          label="City or town"
          value={draft.cityMunicipality}
          onChange={(e) => set({ cityMunicipality: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Mobile number"
          value={draft.mobileNumber}
          onChange={(e) => set({ mobileNumber: e.target.value })}
        />
        <TextInput
          label="Email"
          type="email"
          value={draft.email}
          onChange={(e) => set({ email: e.target.value })}
        />
      </div>

      <SelectInput
        label="Breakout session"
        options={SESSION_OPTIONS}
        value={draft.breakoutSession}
        onChange={(e) => set({ breakoutSession: e.target.value })}
      />

      {error !== null && <Callout tone="error">{error}</Callout>}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" loading={busy}>
          Save changes
        </Button>
        <Button type="button" size="sm" variant="quiet" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * Corrections to what someone typed. The payment reference matters most: it is
 * the key the Payments view groups deposits by, so fixing a mistyped one is
 * also how two payment cards become a single deposit again.
 */
export function EditRegistration({
  registration,
  participants,
  onDone,
}: {
  registration: Registration;
  participants: Participant[];
  onDone: () => void;
}) {
  const update = useMutation(api.organizer.updateRegistration);
  const [groupName, setGroupName] = useState(registration.groupName ?? "");
  const [reference, setReference] = useState(registration.paymentReference ?? "");
  const [datePaid, setDatePaid] = useState(registration.datePaid ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const referenceChanged =
    reference.trim() !== (registration.paymentReference ?? "").trim();

  return (
    <div className="flex flex-col gap-5">
      <form
        noValidate
        className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          setSaved(false);
          void update({
            registrationId: registration._id,
            groupName,
            paymentReference: reference,
            datePaid,
          })
            .then(() => setSaved(true))
            .catch((caught) =>
              setError(
                caught instanceof ConvexError
                  ? String(caught.data)
                  : "Could not save those changes.",
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        <Eyebrow>Registration details</Eyebrow>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label="Group name"
            optional
            value={groupName}
            placeholder="Leave empty for an individual"
            onChange={(e) => setGroupName(e.target.value)}
          />
          <TextInput
            label="Date paid"
            type="date"
            value={datePaid}
            onChange={(e) => setDatePaid(e.target.value)}
          />
        </div>

        <TextInput
          label="Payment reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          hint="Deposits are grouped by this. Matching it to another registration's reference merges them into one payment."
        />

        {referenceChanged && (
          <Callout tone="gold">
            Changing the reference moves this registration to a different
            payment in the Payments view.
          </Callout>
        )}

        {error !== null && <Callout tone="error">{error}</Callout>}
        {saved && <Callout tone="teal">Saved.</Callout>}

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" loading={busy}>
            Save
          </Button>
          <Button type="button" size="sm" variant="quiet" onClick={onDone}>
            Done editing
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <Eyebrow>People on this registration</Eyebrow>
        {participants.map((participant) =>
          editing === participant._id ? (
            <ParticipantFields
              key={participant._id}
              participant={participant}
              onDone={() => setEditing(null)}
            />
          ) : (
            <div
              key={participant._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-4"
            >
              <div className="min-w-0">
                <p className="text-[15px] font-medium text-ink">
                  {participant.fullName}
                </p>
                <p className="text-[13px] text-muted">
                  {participant.age} · {participant.email} ·{" "}
                  {participant.churchOrganization}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(participant._id)}
              >
                Edit
              </Button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
