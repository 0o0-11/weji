import type { Metadata, Viewport } from "next";
import { Inter, Cairo } from "next/font/google";
import { LocaleProvider, LOCALE_BOOTSTRAP_SCRIPT } from "@/lib/i18n/LocaleProvider";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { LibraryProvider } from "@/lib/library/LibraryProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WEJI ويجي — Find any picture",
  description:
    "Search millions of photos, wallpapers and news pictures in English and Arabic. ابحث عن ملايين الصور والخلفيات بالعربية.",
};

export const viewport: Viewport = {
  themeColor: "#07070a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${inter.variable} ${cairo.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets lang + dir before first paint so Arabic never flashes LTR. */}
        <script dangerouslySetInnerHTML={{ __html: LOCALE_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <LocaleProvider>
          <AuthProvider>
            <LibraryProvider>{children}</LibraryProvider>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
