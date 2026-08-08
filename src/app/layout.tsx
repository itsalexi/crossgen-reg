import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { siteUrl } from "@/lib/site";
import { EVENT } from "@convex/shared";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const DESCRIPTION = `Isang araw para sa buong pamilya — ${EVENT.date} sa ${EVENT.venue}, Las Piñas. ${EVENT.minAge} pataas. Mag-register online: ₱450 each, ₱350 kapag lima o higit pa.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${EVENT.name} — ${EVENT.tagline}`,
    template: `%s · CrossGen 2026`,
  },
  description: DESCRIPTION,
  applicationName: EVENT.name,
  keywords: [
    "CrossGen",
    "CrossGen 2026",
    "CrossGen Family Summit",
    "PCEC Family Commission",
    "PCEC",
    "family conference Philippines",
    "family discipleship",
    "GCF South Metro",
    "Las Piñas",
  ],
  authors: [{ name: "PCEC Family Commission" }],
  creator: "PCEC Family Commission",
  publisher: "PCEC Family Commission",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: EVENT.name,
    title: `${EVENT.name} — ${EVENT.tagline}`,
    description: DESCRIPTION,
    url: "/",
    locale: "en_PH",
  },
  twitter: {
    card: "summary_large_image",
    title: `${EVENT.name} — ${EVENT.tagline}`,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#3e2a85",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html
        lang="en-PH"
        className={`${inter.variable} ${poppins.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col">
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
