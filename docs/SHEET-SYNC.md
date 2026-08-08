# Google Sheet sync

The **Sync now** button on the organizer dashboard replaces the contents of a
Google Sheet with the current participant list — one row per person, both
website and Google Form registrations together.

Nothing syncs automatically. Someone presses the button.

## Why it works this way

Writing to a Sheet needs Google credentials. The usual route is a Google Cloud
service account, which means creating a project, enabling the Sheets API,
downloading a private key, and storing that key in the deployment.

Instead, the sheet writes itself. A small script bound to the sheet accepts a
POST and rewrites the tab. The only secret involved is a token you generate,
and the script can only ever touch the one sheet it lives in — so a leaked
token cannot reach anything else in the Google account.

## Setting it up — about five minutes, once

**1. Make the sheet.** A new Google Sheet, or a fresh tab in an existing one.
Name the tab `Participants`.

**2. Generate a token.** Any long random string. For example:

```bash
openssl rand -hex 32
```

**3. Add the script.** In the sheet: **Extensions → Apps Script**. Delete
whatever is there, paste this, and replace `PASTE_YOUR_TOKEN_HERE` with the
token from step 2:

```javascript
const SECRET = 'PASTE_YOUR_TOKEN_HERE';
const TAB = 'Participants';

function doPost(e) {
  const out = (payload) =>
    ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
      ContentService.MimeType.JSON,
    );

  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return out({ error: 'bad token' });

    const sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB) ||
      SpreadsheetApp.getActiveSpreadsheet().insertSheet(TAB);

    sheet.clear();
    const rows = [body.headers].concat(body.rows);
    sheet.getRange(1, 1, rows.length, body.headers.length).setValues(rows);
    sheet.getRange(1, 1, 1, body.headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);

    return out({ ok: true, rows: body.rows.length });
  } catch (error) {
    return out({ error: String(error) });
  }
}
```

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

One row per participant, oldest registration first, with the registration
number, source (Website or Google Form), group, all twelve participant
fields, payment details, receipt, referral, photo consent, and the date
registered.

Each sync **replaces** the tab's contents rather than appending, so the sheet
is always a straight mirror. Anything typed into that tab by hand is
overwritten — keep notes on a different tab.

## When it fails

The dashboard shows the reason under the Sync button. Common ones:

- **"Google Sheet sync is not set up yet"** — the two env vars are missing.
- **"Sheet refused the update: {"error":"bad token"}"** — the token in the
  script and the one in `SHEET_SYNC_SECRET` differ.
- **A sign-in page comes back instead of JSON** — the deployment's *Who has
  access* is not set to **Anyone**.

Changing the script requires **Deploy → Manage deployments → Edit → New
version**, otherwise the old code keeps serving.
