import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#00205C",
};

export const metadata: Metadata = {
  title: "ALDI Einkaufsliste",
  description: "Intelligente Einkaufsliste für ALDI SÜD",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/icons/icon_32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon_192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon_512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon_180.png", sizes: "180x180" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "ALDI Einkaufsliste",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
