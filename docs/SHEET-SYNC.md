# Google Sheet sync

The **Sync now** button on the organizer dashboard does two things, in order:

1. **Pulls** any new responses from the original Google Form into the database.
2. **Pushes** the whole event out to a Google Sheet as six tabs, website and
   Google Form registrations together.

The old form stays live because its QR codes are already printed and in
circulation, so this is the route its answers take to reach the dashboard.
Nothing runs on a schedule — someone presses the button.

A failed pull does not block the push, and the dashboard reports it: a Drive
hiccup should not also stop the sheet being brought up to date.

## Why it works this way

Writing to a Sheet needs Google credentials. The usual route is a Google Cloud
service account, which means creating a project, enabling the Sheets API,
downloading a private key, and storing that key in the deployment.

Instead, the sheet writes itself. A small script bound to the sheet accepts a
POST and rewrites the tab. The only secret involved is a token you generate,
and the script can only ever touch the one sheet it lives in — so a leaked
token cannot reach anything else in the Google account.

## Setting it up — about five minutes, once

**1. Make the sheet.** A new Google Sheet. The tabs are created for you on the
first sync, so there is nothing to name.

**2. Generate a token.** Any long random string. For example:

```bash
openssl rand -hex 32
```

**3. Add the script.** In the sheet: **Extensions → Apps Script**. Delete
whatever is there, paste this, and replace `PASTE_YOUR_TOKEN_HERE` with the
token from step 2:

Replace `PASTE_YOUR_TOKEN_HERE` with the token from step 2, and `PASTE_SHEET_ID`
with the long id out of the sheet's own URL, the part between `/d/` and `/edit`.

```javascript
const SECRET = 'PASTE_YOUR_TOKEN_HERE';
const SHEET_ID = 'PASTE_SHEET_ID';

function doPost(e) {
  const out = function (payload) {
    return ContentService.createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  };

  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return out({ error: 'bad token' });

    const book = SpreadsheetApp.openById(SHEET_ID);

    // Older deployments sent a single tab. Both shapes are accepted so the
    // sheet keeps working whichever side is updated first.
    const tabs = body.sheets || [
      { name: 'Participants', headers: body.headers, rows: body.rows },
    ];

    tabs.forEach(function (tab, position) {
      const width = tab.headers.length;
      let sheet = book.getSheetByName(tab.name);
      if (!sheet) sheet = book.insertSheet(tab.name);
      sheet.clear();

      // Every row padded to the header width, or setValues rejects the lot.
      const values = [tab.headers].concat(
        tab.rows.map(function (row) {
          const padded = row.slice(0, width);
          while (padded.length < width) padded.push('');
          return padded;
        })
      );

      sheet.getRange(1, 1, values.length, width).setValues(values);
      sheet.getRange(1, 1, 1, width).setFontWeight('bold');
      sheet.setFrozenRows(1);

      // Anything the backend marked with (₱) is money.
      tab.headers.forEach(function (header, column) {
        if (String(header).indexOf('(₱)') !== -1 && values.length > 1) {
          sheet
            .getRange(2, column + 1, values.length - 1, 1)
            .setNumberFormat('"₱"#,##0');
        }
      });

      sheet.autoResizeColumns(1, width);
      book.setActiveSheet(sheet);
      book.moveActiveSheet(position + 1);
    });

    // Any other tab — Notes, or anything the team made — is left untouched.
    return out({ ok: true, tabs: tabs.length });
  } catch (error) {
    return out({ error: String(error) });
  }
}
```

`openById` rather than `getActiveSpreadsheet`, so the script works whether it
was created from inside the sheet or on its own.

**4. Deploy it.** **Deploy → New deployment → Web app**. Set *Execute as* to
**Me**, and *Who has access* to **Anyone**. Approve the permission prompt.
Copy the `/exec` URL it gives you.

> *Anyone* means anyone with the URL can POST to it — which is why the token
> check is the first thing the script does. Requests without the token are
> rejected before the sheet is touched.

**5. Tell the deployment about it.**

```bash
npx convex env set SHEET_SYNC_URL "https://script.google.com/macros/s/.../exec" --prod
npx convex env set SHEET_SYNC_SECRET "your-token" --prod
```

Then press **Sync now** under *Organizers* in the dashboard. It reports how
many rows it wrote, and the dashboard remembers who synced last and when.

## What lands in the sheet

Six tabs, in this order. Each one answers a question without needing to be
sorted or filtered first.

| Tab | One row per | What it's for |
|---|---|---|
| **Summary** | figure | Headcount, money in against money expected, session split, ages, churches, cities |
| **Check-in** | person, A to Z by surname | The door on the day. Only people who are paid up or exempt |
| **Participants** | person | The full roster, everyone, with all the detail and payment state |
| **Sessions** | person, grouped by breakout | Room sizes and rosters, each block under its own headcount |
| **Groups** | group | Size, rate, expected, received, and the gap. Worst first |
| **Payments** | payment reference | Reconciliation. Unchecked deposits and shortfalls float to the top |

**Check-in is decided on the money, not on the flag.** Someone is on it when
the deposit covering them is at least what they owe, or when they are a
speaker, volunteer or sponsor. A deposit marked "needs sorting" because other
people are missing from it does not keep the person in front of you off the
list.

Two columns are worth understanding on the Participants tab. **Deposit Total**
is written once per payment reference, against the first person who cites it,
because printing ₱1,400 against each of four people made the column add up to
four times what the bank holds. **Share Per Person** is that deposit divided by
the people it covered, and it is on every row. Both columns add up to something
true.

### Keeping your own notes

Each sync **replaces** the contents of those six tabs. Anything typed into them
by hand is overwritten.

Make a tab called `Notes`, or anything else not in the list above, and sync
will never touch it. That is the only safe place for hand-written columns and
formulas.

## When it fails

The dashboard shows the reason under the Sync button. Common ones:

- **"Google Sheet sync is not set up yet"** — the two env vars are missing.
- **"Sheet refused the update: {"error":"bad token"}"** — the token in the
  script and the one in `SHEET_SYNC_SECRET` differ.
- **A sign-in page comes back instead of JSON** — the deployment's *Who has
  access* is not set to **Anyone**.

## Changing the script later

**Deploy → Manage deployments → Edit (the pencil) → Version: New version →
Deploy.** Saving the file alone does nothing: the old code keeps serving until
a new version is deployed.

That route keeps the same deployment, so **the `/exec` URL does not change** and
there is nothing to update in Convex. Only **Deploy → New deployment** mints a
new URL, and then `SHEET_SYNC_URL` has to be set again.
