import Image from "next/image";
import QRCode from "qrcode";
import { EVENT } from "@convex/shared";

/**
 * The thing somebody holds up at the door.
 *
 * Rendered on the server so the code is already in the HTML: an attendee
 * standing in a queue with one bar of signal should not be waiting on a
 * JavaScript bundle to draw their pass.
 *
 * The code carries the bare participant id, not a URL. A stray scan by a
 * passer-by's camera app then shows a meaningless string rather than opening a
 * page about that person.
 */
export async function qrDataUrl(value: string): Promise<string> {
  return await QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 640,
    color: { dark: "#191528", light: "#ffffff" },
  });
}

export async function DoorPass({
  id,
  name,
  session,
  registrationNumber,
  group,
}: {
  id: string;
  name: string;
  session: string;
  registrationNumber: string;
  group?: string;
}) {
  const code = await qrDataUrl(id);

  return (
    <article className="flex break-inside-avoid flex-col items-center gap-4 rounded-2xl border-2 border-line bg-white px-5 py-6 text-center">
      <div>
        <p className="font-display text-[22px] leading-[1.15] font-bold text-ink">
          {name}
        </p>
        {group !== undefined && group.length > 0 && (
          <p className="mt-1 text-[14px] text-muted">{group}</p>
        )}
      </div>

      {/* Deliberately large: it is scanned off a phone screen held at arm's
          length, often with a cracked protector and the brightness turned down. */}
      <Image
        src={code}
        alt={`Check-in code for ${name}`}
        width={220}
        height={220}
        unoptimized
        className="size-[220px]"
      />

      <div>
        <p className="text-[12.5px] font-semibold tracking-[0.07em] text-muted uppercase">
          Workshop
        </p>
        <p className="mt-1 text-[15px] leading-snug font-semibold text-ink">
          {session}
        </p>
      </div>

      <p className="text-[13px] text-faint">
        {registrationNumber} · {EVENT.dayOfWeek}, {EVENT.date} · {EVENT.venue}
      </p>
    </article>
  );
}
