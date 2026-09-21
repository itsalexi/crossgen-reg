import QRCode from "qrcode";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";

/**
 * One person's code, as an image.
 *
 * So the QR can sit inside the email itself rather than behind a link. Most
 * people will not tap a link on the morning of an event; a code already on
 * screen is one they can screenshot the moment it arrives.
 *
 * The id is checked against a real participant before anything is drawn. Not
 * for secrecy — the code carries only that id, and the pass page is public by
 * unguessable link — but so this cannot be used as a free QR generator on our
 * own domain, and so a mistyped link returns nothing rather than a valid-
 * looking code for a person who does not exist.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const participantId = id.replace(/\.png$/i, "");

  const pass = await fetchQuery(api.checkin.pass, { participantId });
  if (pass === null) {
    return new Response("Not found", { status: 404 });
  }

  const png = await QRCode.toBuffer(pass.id, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 600,
    color: { dark: "#191528", light: "#ffffff" },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // Nobody's code changes, and a mail merge to 430 inboxes will ask for
      // some of these many times over as clients fetch and re-fetch.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="${pass.registrationNumber}.png"`,
    },
  });
}
