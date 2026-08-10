"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button, Callout, Eyebrow, Pill, Spinner, TextInput } from "@/components/ui";
import { longDate } from "./parts";

export function AdminsSection() {
  const me = useQuery(api.organizer.whoAmI);
  const organizers = useQuery(api.organizer.listOrganizers);
  const addOrganizer = useMutation(api.organizer.addOrganizer);
  const removeOrganizer = useMutation(api.organizer.removeOrganizer);

  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Id<"organizers"> | null>(null);

  const syncState = useQuery(api.organizer.sheetSyncState);
  const syncToSheet = useAction(api.organizer.syncToSheet);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function add() {
    setAdding(true);
    setError(null);
    try {
      await addOrganizer({ email, note: note.trim() || undefined });
      setEmail("");
      setNote("");
    } catch (caught) {
      setError(
        caught instanceof ConvexError
          ? String(caught.data)
          : "Could not add that account.",
      );
    } finally {
      setAdding(false);
    }
  }

  if (organizers === undefined) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-6 text-cg-purple" />
      </div>
    );
  }

  return (
    <div className="flex max-w-[760px] flex-col gap-6">
      <div>
        <h1 className="font-display text-[22px] font-semibold text-ink">
          Who can see the registrations
        </h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
          Anyone listed here can open this dashboard, read every participant&rsquo;s
          details, and download the export. Add people sparingly.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Eyebrow>Google Sheet</Eyebrow>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
              Pulls any new Google Form responses in, then pushes every
              participant out to the shared sheet, replacing what is there. The
              old form is still live, so this is how its answers reach the
              dashboard. Nothing runs on its own.
            </p>
          </div>
          <Button
            variant="outline"
            loading={syncing}
            onClick={() => {
              setSyncing(true);
              setSyncMessage(null);
              void syncToSheet()
                .then((r) =>
                  setSyncMessage(
                    [
                      r.imported > 0
                        ? `Pulled ${r.imported} new form response${r.imported === 1 ? "" : "s"}.`
                        : "No new form responses.",
                      `Sheet updated — ${r.rows} rows.`,
                      r.importError ? `Form could not be read: ${r.importError}` : "",
                    ]
                      .filter(Boolean)
                      .join(" "),
                  ),
                )
                .catch((caught) =>
                  setSyncMessage(
                    caught instanceof ConvexError
                      ? String(caught.data)
                      : "Could not reach the sheet.",
                  ),
                )
                .finally(() => setSyncing(false));
            }}
          >
            Sync now
          </Button>
        </div>

        <p className="text-[13px] text-muted">
          {syncState == null
            ? "Never synced."
            : syncState.lastStatus === "ok"
              ? `Last synced ${longDate(syncState.lastSyncedAt)} by ${syncState.byEmail} — ${syncState.rows} rows${
                  syncState.imported ? `, ${syncState.imported} pulled from the form` : ""
                }.`
              : `Last attempt ${longDate(syncState.lastSyncedAt)} failed: ${syncState.lastError}`}
        </p>

        {syncMessage !== null && (
          <Callout tone={syncMessage.startsWith("Sheet updated") ? "teal" : "error"}>
            {syncMessage}
          </Callout>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <ul className="divide-y divide-line">
          {organizers.map((entry) => {
            const isMe = entry.email === me?.email;
            return (
              <li
                key={entry.email}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[15px] font-medium text-ink">
                      {entry.email}
                    </span>
                    {entry.isOwner && <Pill tone="purple">Owner</Pill>}
                    {isMe && <Pill tone="muted">You</Pill>}
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {entry.isOwner
                      ? "Set in the deployment config — can't be removed here."
                      : `Added by ${entry.addedByEmail}${
                          entry.addedAt ? ` on ${longDate(entry.addedAt)}` : ""
                        }`}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </p>
                </div>

                {!entry.isOwner && entry.id !== null && !isMe && (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={removing === entry.id}
                    onClick={() => {
                      setRemoving(entry.id);
                      void removeOrganizer({ id: entry.id as Id<"organizers"> })
                        .catch((caught) =>
                          setError(
                            caught instanceof ConvexError
                              ? String(caught.data)
                              : "Could not remove that account.",
                          ),
                        )
                        .finally(() => setRemoving(null));
                    }}
                  >
                    Remove
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5">
        <Eyebrow>Add an organizer</Eyebrow>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Google account email"
              type="email"
              inputMode="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
            />
            <TextInput
              label="Note"
              optional
              placeholder="Registration desk, finance…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error !== null && <Callout tone="error">{error}</Callout>}

          <div className="flex items-center gap-3">
            <Button type="submit" loading={adding} disabled={email.trim().length === 0}>
              Add organizer
            </Button>
            <span className="text-[13px] text-muted">
              They sign in with Google using this exact address.
            </span>
          </div>
        </form>
      </section>

      <p className="text-[13px] leading-relaxed text-muted">
        Owners come from the deployment&rsquo;s <code>ORGANIZER_EMAILS</code>{" "}
        setting, so there is always a way back in even if this list is emptied by
        mistake. You can&rsquo;t remove your own access.
      </p>
    </div>
  );
}
