import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
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

export const metadata: Metadata = {
  title: {
    default: `${EVENT.name} — Registration`,
    template: `%s — ${EVENT.name}`,
  },
  description: `Register for the ${EVENT.name}. ${EVENT.date} at ${EVENT.venue}, ${EVENT.address}.`,
};

export const viewport: Viewport = {
  themeColor: "#291a5c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html
        lang="en"
        className={`${inter.variable} ${poppins.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col">
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
