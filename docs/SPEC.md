# CrossGen Family Summit 2026 — Registration System

**Canonical spec, v1.1.** Supersedes the original draft. All internal contradictions resolved — see [§0 Resolved Decisions](#0-resolved-decisions) for what changed and why.

---

## 0. Resolved Decisions

The original draft contradicted itself in nine places. Resolutions below are binding for V1.

| # | Issue | Resolution |
|---|---|---|
| 1 | `Preferred Name` listed as both required and optional | **Optional.** Falls back to first token of `fullName` in emails and name badges. |
| 2 | `Occupation` listed as required, then as "optional if organizers decide" | **Required.** Organizers can relax later; tightening after launch is harder than loosening. |
| 3 | `registrationType` stored only on the registration, but the draft's §10 also wanted mixed types within one group | **Mixed types dropped.** One registration = one type. Everyone in a registration is regular, or everyone is a speaker / volunteer / sponsor. A family with one volunteer files two registrations. See [§10](#10-one-type-per-registration). |
| 4 | Registration numbers (`CG26-00042`) with no source of sequence | **`counters` table** + atomic read-modify-write inside the submit mutation. Convex has no autoincrement. |
| 5 | "Authenticated organizer" required, but `users` has no role | **Env allowlist** `ORGANIZER_EMAILS` (comma-separated), checked server-side in every organizer query. No role-management UI. |
| 6 | Email sent "immediately after save", but Convex mutations cannot make network calls | **Mutation schedules an action**: `ctx.scheduler.runAfter(0, internal.email.sendConfirmation, { registrationId })`. Satisfies [§27](#27-email-failure-handling) for free — the action failing cannot roll back the write. |
| 7 | File type/size limits stated, but Convex upload URLs accept anything | **Validate twice.** Client pre-check for UX; submit mutation re-checks `ctx.storage.getMetadata()` for `size` and `contentType` and rejects the submission if either is out of bounds. |
| 8 | Confirmation email recipient unspecified for groups | **Registrant only.** One email per registration, to the signed-in Google account. Participant emails are collected for organizer use, not for V1 mail. |
| 9 | Nothing prevents double submission | **Idempotency key.** Client generates a UUID when the form is first opened; submit mutation upserts on it. Re-submitting returns the existing registration instead of creating a second one. |

Consequence of #3: the draft's `payingParticipantCount` field is **dropped**. It could only ever be `participantCount` (regular) or `0` (exempt), so storing it adds a way for the row to contradict itself and nothing else.

---

## 1. Overview

Web-based registration for the CrossGen Family Summit 2026, replacing the Google Form as the primary flow while organizers keep a master participant list.

The system:

- Collects a registration record for every participant
- Supports individual and group registration
- Calculates fees automatically, server-side
- Collects payment details and proof of payment
- Supports non-paying participants (speakers, volunteers, sponsors)
- Sends a confirmation email after registration
- Stores registration data and payment proof in Convex
- Lets organizers view, filter, and export registrations
- Allows the old Google Form list to be merged in later

One-off system for CrossGen 2026. Not a reusable form builder or generic registration platform.

## 2. Event Information

**CrossGen Family Summit 2026**
Date: September 26, 2026 (Saturday)
Venue: GCF South Metro, Daang Hari Road, Almanza Dos, Las Piñas
Age requirement: 14 and above

### Fees

- Regular: **₱450 / person**
- Group: **₱350 / person**, for registrations of 5 or more participants

### Payment Account

```
Bank:           BDO
Account Name:   PCEC
Account Number: 003980000243
Branch:         Anonas-Kamias
```

## 3. Brand

Assets supplied by the organizers: the CrossGen event banner and the PCEC Family Commission mark.

Save both to `public/brand/` before building UI:

```
public/brand/crossgen-banner.png       # wide event banner, use as hero
public/brand/pcec-family-commission.png # circular mark, use in header + email footer
```

Tagline (banner): *Pamilyang Sama-Sama, Henerasyong Nagkaka-isa*
Verse (banner): Awit 145:4

Palette below is eyeballed from the supplied artwork. **Sample exact values from the asset files once they land** and correct these tokens.

| Token | Approx. hex | Use |
|---|---|---|
| `--cg-purple` | `#402C86` | Primary background, hero |
| `--cg-purple-light` | `#4B3795` | Wave pattern, card surfaces on dark |
| `--cg-teal` | `#3A97B9` | Secondary, PCEC mark background, links |
| `--cg-gold` | `#F5B800` | Primary CTA, active step, price emphasis |
| `--cg-copper` | `#B5714A` | Accent stripe, dividers |
| `--cg-white` | `#FFFFFF` | Body text on purple |

Type: banner uses a geometric rounded sans. Poppins or Nunito is a close free substitute — pick one and use it throughout.

### Design pegs

Two references supplied by the organizers.

**[across.ccf.org.ph](https://across.ccf.org.ph/)** — closest structural peg. Ministry site with a single-color brand (green + white), modern sans, and an event block that states date, time, venue, and fee inline (`💰 Registration Fee: P550`) directly above the signup link. Content flows as image-backed cards; nav is a simple horizontal bar. Take from it: the event-detail block pattern, fee stated plainly next to the CTA, and card-based sectioning.

**[familydiscipleship.com](https://www.familydiscipleship.com/)** — tonal peg. Minimalist, heavy white space, serif + sans pairing, muted palette, one clear CTA per block. Take from it: restraint and readability, not layout.

Synthesis for the CrossGen landing page:

```
Hero            crossgen-banner.png full-bleed, tagline + verse, [Register] CTA in --cg-gold
Event details   date · venue · age requirement, stated plainly (Across pattern)
Fees            two-card comparison — Regular ₱450 vs Group ₱350 (5+ participants)
Breakouts       five cards, one per session
Payment info    BDO account block
Privacy notice  organizers' existing text
Footer          PCEC + PCEC Family Commission marks
```

Purple hero, white content body. Gold reserved for CTAs only — if it appears on more than the primary action per screen, it stops reading as a button.

## 4. Registration Flow

### Step 1 — Sign in

Google OAuth. After auth, prefill the registrant's name and email. Both stay editable.

### Step 2 — Registration type

Chosen once, for the whole registration:

- **Regular Participant** — payment required
- **Speaker** — exempt
- **Volunteer** — exempt
- **Sponsor** — exempt

Everyone in the registration shares the chosen type ([§10](#10-one-type-per-registration)). The system stores *why* an exempt registration owes ₱0, never a bare `amount = 0`.

## 5. Participant Information

Every participant gets their own record.

**Required**

- Full Name
- Age
- Gender
- Marital Status
- Church / Organization
- Ministry Involvement in Church
- Occupation
- Mobile Number
- Email Address
- City / Municipality
- Breakout Session

Registration type is not a per-participant field — it is set once for the registration ([§10](#10-one-type-per-registration)).

**Optional**

- Preferred Name

## 6. Breakout Session

Exactly one per participant. No multi-select.

1. Making Family Discipleship Work at Home and In Our Church
2. Family Flourishing: Well-Being & Mental Health
3. Solo Parenting and Discipleship
4. Faith and Family Connection in the Digital Age
5. Fearfully & Wonderfully Made: Navigating Sex, Gender, and Identity

## 7. Group Registration

Multiple participants under one registration.

Example — Alex registers himself, his parents, and two siblings:

```
Group Name:            Canamo Family
Number of Participants: 5
```

The system then collects full information for each individual.

**A group is not a participant.** Every person needs their own name, age, gender, marital status, church, ministry, occupation, mobile, email, city, breakout session, and registration type. The group only associates those records.

## 8. Structure

```
Registration
├── Group: Canamo Family
├── Registrant: Alexi (Google account)
├── Participant 1
├── Participant 2
├── Participant 3
├── Participant 4
└── Participant 5
```

Each participant has a unique ID. Each registration has a unique ID plus a human-readable registration number.

## 9. Pricing

Exempt registrations total ₱0. Regular registrations are priced on head count.

**1–4 participants:** ₱450 each

```
1 → ₱450     2 → ₱900     3 → ₱1,350     4 → ₱1,800
```

**5+ participants:** ₱350 each

```
5 → ₱1,750   6 → ₱2,100   10 → ₱3,500
```

The calculated amount is shown before submission.

```
totalAmount = registrationType === "regular"
  ? participantCount * (participantCount >= 5 ? 350 : 450)
  : 0
```

## 10. One Type Per Registration

A registration has exactly one type. Every participant in it is that type. There is no per-participant override and no mixed group.

A family where four members are regular attendees and one is a volunteer files **two registrations**:

```
Registration A — Regular   — 4 participants — ₱450 × 4 = ₱1,800
Registration B — Volunteer — 1 participant  — ₱0
```

They receive two registration numbers and two confirmation emails. Organizers can associate them by group name if both use the same one.

**Rate consequence worth stating plainly:** splitting a 5-person family this way costs more than a single 5-person regular registration (₱1,800 vs ₱1,750), because the group rate keys off the participants on one registration. Surface the group-rate threshold on the pricing step so registrants see this before splitting.

## 11. Payment Information

Shown only when `registrationType = regular`. Exempt registrations skip the step entirely.

Fields:

- Total amount due (read-only, server-computed)
- Payment Reference Number
- Date Paid
- Proof of Payment

### Proof of Payment

One file per registration.

- Max size: **10 MB**
- Types: **JPG / JPEG, PNG, PDF**
- Stored in Convex file storage; the storage ID is saved on the registration
- Validated client-side for UX **and** re-validated in the submit mutation via `ctx.storage.getMetadata()` — see [§0.7](#0-resolved-decisions)

No OCR, no document processing.

## 12. Payment Exemptions

Speaker, volunteer, and sponsor registrations upload nothing. The payment step is skipped and the registration records:

```
paymentType     = exempt
exemptionReason = speaker | volunteer | sponsor    (mirrors registrationType)
totalAmount     = 0
```

`exemptionReason` is redundant with `registrationType` by construction, but is stored explicitly so the payment story reads on its own and the export needs no lookup. This avoids organizers entering fake payment references or dummy uploads.

## 13. Payment Verification

**None.** The system does not judge whether a screenshot is genuine. No OCR, no bank API, no BDO integration, no manual approval gate, no `paymentVerified` workflow in V1.

It records exactly one fact: *the participant submitted this payment proof.* The confirmation email must reflect that distinction.

## 14. Registration Confirmation

On successful submission, the scheduled Resend action emails the registrant ([§0.6](#0-resolved-decisions), [§0.8](#0-resolved-decisions)).

The email states:

- Registration was received
- Payment proof was received, if applicable
- Registration number
- Participant / group information
- Amount submitted
- Event details

It must **not** say "Your payment has been verified." It says "We have received your registration and payment proof."

## 15. Example Confirmation Email

**Subject:** CrossGen 2026 Registration Received

```
Hi Alex,

Thank you for registering for the CrossGen Family Summit 2026!
We have successfully received your registration.

Registration #:      CG26-00042
Participants:        5
Registration Type:   Group Registration
Amount:              ₱1,750

We have also received your submitted proof of payment.
Please keep this email for your records.

CrossGen Family Summit 2026
September 26, 2026
GCF South Metro
Daang Hari Road, Almanza Dos, Las Piñas

We look forward to seeing you there!
```

Exempt variant:

```
Registration Type:   Volunteer
Registration Fee:    ₱0

No payment is required for this registration.
```

## 16. Registration Number

Format `CG26-#####`, zero-padded, sequential:

```
CG26-00001
CG26-00002
CG26-00003
```

Generated by an atomic read-modify-write against the `counters` table inside the submit mutation ([§0.4](#0-resolved-decisions)). Never derived from a Google account ID.

Appears in: confirmation email, organizer dashboard, CSV export.

## 17. Database Structure

### `registrations`

```
registrations
├── _id
├── registrationNumber        string    "CG26-00042"
├── idempotencyKey            string    unique; blocks double-submit (§0.9)
├── groupName                 string?   null for solo registrations
├── registrantUserId          Id<users>
├── registrationType          "regular" | "speaker" | "volunteer" | "sponsor"
├── participantCount          number
├── totalAmount               number    server-computed, in pesos
├── paymentType               "paid" | "exempt"
├── exemptionReason           "speaker" | "volunteer" | "sponsor" | null
├── paymentReference          string?   required when paymentType = "paid"
├── datePaid                  string?   required when paymentType = "paid"
├── paymentProofStorageId     Id<_storage>?  required when paymentType = "paid"
├── createdAt                 number
└── updatedAt                 number
```

Individual vs group is not stored — it is `participantCount > 1`, computed wherever the confirmation email or dashboard needs the label.

Indexes: `by_registrationNumber`, `by_idempotencyKey`, `by_registrantUserId`, `by_createdAt`.

### `participants`

```
participants
├── _id
├── registrationId       Id<registrations>
├── fullName             string
├── preferredName        string?
├── age                  number    >= 14
├── gender               string
├── maritalStatus        string
├── churchOrganization   string
├── ministryInvolvement  string
├── occupation           string
├── mobileNumber         string
├── email                string
├── cityMunicipality     string
├── breakoutSession      1 | 2 | 3 | 4 | 5
└── createdAt            number
```

Indexes: `by_registrationId`.

### `users`

```
users
├── _id
├── googleId    string
├── name        string
├── email       string
├── image       string?
└── createdAt   number
```

Indexes: `by_googleId`, `by_email`.

No `role` column — organizer access is an env allowlist ([§0.5](#0-resolved-decisions)).

### `counters`

```
counters
├── _id
├── name     string    "registrationNumber"
└── value    number
```

Indexes: `by_name`.

## 18. Old Google Form

The existing Google Form stays live temporarily. Anyone holding the old link, QR code, or shared URL can still register through it. No immediate migration.

## 19. Existing Google Sheet

Existing registrations stay in Sheets; new ones go to Convex; the two lists merge at the end of the registration period.

```
Old Google Form → Existing Google Sheet ─┐
                                          ├── Master participant list
New Registration System → Convex ────────┘
```

No live Sheets sync in V1. A one-time import can normalize the old rows later if needed.

## 20. Organizer View

Access gated by the `ORGANIZER_EMAILS` allowlist, enforced server-side in every query — not just hidden in the UI.

List view columns: registration number, date registered, group name, participant count, total amount, registration type, payment reference, payment proof, breakout sessions.

Detail view: clicking a registration shows all attached participants.

Payment proof: organizer can open or download the file.

No approval workflow.

## 21. Filtering

Basic filters only:

- Registration number
- Participant name
- Group name
- Registration type
- Breakout session
- Date registered
- Payment type *(optional)*

No analytics dashboard.

## 22. Export

CSV, **one row per participant**:

```
Registration Number
Group Name
Full Name
Preferred Name
Age
Gender
Marital Status
Church / Organization
Ministry Involvement
Occupation
Mobile Number
Email
City / Municipality
Breakout Session
Registration Type        ┐
Payment Type             │ registration-level values,
Payment Reference        │ repeated on every participant row
Date Paid                │
Amount                   ┘
Date Registered
```

## 23. Registration UI

Multi-step form, not one long page:

```
1. Welcome
2. Registration Type
3. Participant Information
4. Additional Participants
5. Payment
6. Review
7. Submit
8. Confirmation
```

Step 4 is skipped for a single participant. Step 5 is skipped for exempt registration types.

## 24. Review Page

```
Registration Summary

Canamo Family
Regular Participant · 5 participants

Participants
  Alexi Canamo  — Breakout 1
  Maria Canamo  — Breakout 2
  John Canamo   — Breakout 1
  Ana Canamo    — Breakout 3
  Peter Canamo  — Breakout 4

Payment
  Group rate: ₱350/person
  5 participants
  Total: ₱1,750
  Payment reference: BDO123456
  Proof of payment: payment.jpg

[ Submit Registration ]
```

## 25. Validation

Frontend validates before submission; the backend re-validates everything.

Required per registration: registration type, and a group name when there is more than one participant.

Required per participant: full name, age, gender, marital status, church/organization, ministry involvement, occupation, mobile number, email, city/municipality, exactly one breakout session.

Required when `registrationType = regular`: payment reference, date paid, proof of payment. All three must be **absent** when the type is exempt — reject a submission that carries payment data on an exempt registration rather than silently dropping it.

Age rule:

```
age >= 14
```

Under-14 message:

> CrossGen Family Summit is for participants aged 14 and above.

## 26. Submission Safety

Submission is transactional:

1. Validate the payload
2. Check the idempotency key — return the existing registration if already submitted
3. Recalculate the amount **server-side** from `registrationType` and the participant count
4. Validate the uploaded file's size and content type via storage metadata
5. Insert the registration
6. Insert the participants
7. Attach the payment proof storage ID
8. Allocate the registration number from `counters`
9. Schedule the confirmation email action

The backend never trusts a frontend-supplied amount. If the client claims `totalAmount = 100`, Convex recomputes from the type and participant count and uses its own figure.

## 27. Email Failure Handling

A Resend outage must not fail a registration. The write commits first; the email runs in a scheduled action afterward.

```
Registration saved
      ↓
Scheduled action attempts email
      ↓
Success → done
Failure → registration still saved; organizer can resend later
```

## 28. Privacy

Collected: name, age, gender, contact details, church/organization, ministry involvement, payment information, payment proof.

The registration page carries the organizers' existing privacy notice, stating the data is used for registration, event communication, breakout session assignment, and participant care.

Access is limited to authorized organizers, enforced server-side.

## 29. Out of Scope for V1

Generic form builder · reusable registration framework · multi-event support · automatic bank or payment verification · OCR · BDO API · fraud detection · payment gateway · automated Sheets sync · analytics · QR attendance · check-in · ticket generation · refunds · complex roles and permissions · mobile app · SMS.

## 30. Architecture

```
                    ┌─────────────────────┐
                    │  CrossGen Website   │
                    │      Next.js        │
                    └──────────┬──────────┘
                               ↓
                    ┌─────────────────────┐
                    │    Google OAuth     │
                    └──────────┬──────────┘
                               ↓
                    ┌─────────────────────┐
                    │       Convex        │
                    │  registrations      │
                    │  participants       │
                    │  users              │
                    │  counters           │
                    │  file storage       │
                    └───────┬─────┬───────┘
                            │     │
                    ┌───────┘     └────────┐
                    ↓                      ↓
             ┌─────────────┐       ┌──────────────┐
             │ Convex File │       │    Resend    │
             │   Storage   │       │ (scheduled   │
             │             │       │   action)    │
             └─────────────┘       └──────────────┘
```

## 31. Core User Journey

Paying:

```
Sign in with Google → choose registration type → enter participant info
→ add other participants (optional) → system calculates fee
→ upload payment proof → review → submit → saved
→ 📧 "We've received your registration and payment proof."
```

Exempt:

```
Sign in → choose exempt type → enter participant info
→ no payment step → review → submit → 📧 confirmation
```

**Principle:** collect everything the CrossGen team needs, acknowledge the submission automatically, and leave actual payment verification outside the system.
