const FALLBACK = "https://crossgen.pcecfamily.org";

/**
 * Absolute origin for metadata, canonicals, and social cards. Prefers the
 * explicit site URL, falls back to whatever Vercel deployed this build as, so
 * preview deployments produce their own links rather than pointing at prod.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return FALLBACK;
}
