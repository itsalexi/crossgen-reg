import { LandingScreen } from "@/components/LandingScreen";
import { siteUrl } from "@/lib/site";
import {
  EVENT,
  GROUP_RATE,
  GROUP_THRESHOLD,
  PAYMENT_ACCOUNT,
  REGULAR_RATE,
} from "@convex/shared";

/**
 * Event structured data, so a search result can carry the date and venue
 * rather than just a title. ISO 8601 with the Philippine offset.
 */
function eventJsonLd() {
  const base = siteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: EVENT.name,
    alternateName: EVENT.tagline,
    description: `Isang araw para sa buong pamilya sa ${EVENT.venue}, Las Piñas. Para sa edad ${EVENT.minAge} pataas.`,
    startDate: "2026-09-26T08:00:00+08:00",
    endDate: "2026-09-26T17:00:00+08:00",
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: `${base}/opengraph-image`,
    url: base,
    typicalAgeRange: `${EVENT.minAge}-`,
    location: {
      "@type": "Place",
      name: EVENT.venue,
      address: {
        "@type": "PostalAddress",
        streetAddress: "Daang Hari Road, Almanza Dos",
        addressLocality: "Las Piñas",
        addressRegion: "Metro Manila",
        addressCountry: "PH",
      },
    },
    organizer: {
      "@type": "Organization",
      name: `${PAYMENT_ACCOUNT.accountName} Family Commission`,
      url: base,
    },
    offers: [
      {
        "@type": "Offer",
        name: "Regular registration",
        price: REGULAR_RATE,
        priceCurrency: "PHP",
        availability: "https://schema.org/InStock",
        url: `${base}/register`,
      },
      {
        "@type": "Offer",
        name: `Group registration (${GROUP_THRESHOLD} or more)`,
        price: GROUP_RATE,
        priceCurrency: "PHP",
        availability: "https://schema.org/InStock",
        url: `${base}/register`,
      },
    ],
  };
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Values are our own constants, not user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd()) }}
      />
      <LandingScreen />
    </>
  );
}
