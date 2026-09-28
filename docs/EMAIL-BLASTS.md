# Sending an email blast

Everything needed to write to the summit participants, without a developer.

You need two things: a Google account that is on the organizer list, and
Mailmeteor. Nothing else — no software to install, no files from anybody.

## 1. Get the list

Open **crossgen.pcecfamily.org/organizer** and sign in. On the
**Registrations** tab, next to **Export CSV**, click **Email list**.

That downloads `crossgen-email-list.csv`. It is one row per email address, not
one per person, because several people share an inbox: a coordinator with
thirty registrants gets one email holding thirty codes, not thirty emails.

Download it fresh every time. Names change, addresses get corrected, people are
added — a file from last week will write to people who have left and miss
people who have joined.

## 2. Put it in a Google Sheet

New spreadsheet → **File → Import → Upload** → choose the file → **Replace
spreadsheet** → Import.

## 3. Open Mailmeteor

**Extensions → Add-ons → Get add-ons**, search Mailmeteor, install it once.
Then **Extensions → Mailmeteor → New campaign**. It finds the `Email` column on
its own.

## 4. Write the email

Use *Insert variable* to drop in anything from the sheet. The ones that matter:

| Variable | What it puts in |
| --- | --- |
| `{{Greeting}}` | Their first name, or the group's name for a coordinator |
| `{{QrCodes}}` | Their QR codes, drawn, with name and room above each |
| `{{PassLinks}}` | The same codes as links, for a client that blocks images |
| `{{AllCodesLink}}` | One page holding every code on that registration |
| `{{Names}}` | Everyone that email covers |
| `{{Group}}` | Their church or group |

For a design of your own, paste the HTML into **Developer Mode** — the `< >`
button in the editor. Variables still work there. Save from Developer Mode
rather than switching back to the visual editor, which rewrites the markup.

## 5. Test, then send

Send one to yourself first and open it on a phone. It is the only test that
matters and it takes a minute.

Then send. Watch the daily limits:

| | Per day |
| --- | --- |
| Mailmeteor free | 50 |
| Mailmeteor Starter | 250 |
| Mailmeteor Premium | 1,000 |
| Gmail itself, personal account | 500 |
| Gmail itself, Workspace account | 2,000 |

Whichever is lower wins. About 420 addresses covers the whole summit list, so
one send fits inside a personal Gmail's 500 — but not inside the free plan.

## 6. Read the failures

Afterwards Mailmeteor shows a **Failed** list. Read it. Roughly one address in
twenty-five is mistyped, and the failure is silent otherwise — the person just
never hears from you.

What turned up last time, from 431 addresses:

- `…@gmail.con`, `…@gmail.cok`, `…@gmail.com.` — a single wrong character
- `…@yahooo.com` — a domain that accepts no mail at all
- `…@gmil.com` — a lookalike domain that quietly *received* somebody's mail
- `…@yahoo.com` where the person actually uses `…@yahoo.com.ph`

Correct them on the person's registration in the dashboard, download the list
again, and send only to those rows.

## What not to do

**Don't put `{{Greeting}}` in the subject line.** For a coordinator it shows
the first name on their list, so a stranger's name arrives in the subject.

**Don't send the same blast twice to the whole list** to reach a handful of
people. Make a small sheet with only the rows that need it.

**Don't promise a QR code you have not attached.** The single biggest source of
replies was an email telling people to check for a code that had not been sent
yet.

## Who to expect questions from

Coordinators, every time. People who registered a group assume the codes come
to them, and they don't — each person with their own address gets their own,
directly. Only people with no address of their own route to whoever registered
them.

The answer that settles it: *"Ang QR codes ay direktang naipadala sa bawat isa
sa sariling email nila. Kung gusto ninyo ang buong listahan sa isang pahina:
crossgen.pcecfamily.org/passes/<their registration number>"*
