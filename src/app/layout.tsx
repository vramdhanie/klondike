import "./globals.css";

import type { Metadata, Viewport } from "next";

import PwaRegister from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "Klondike",
  description:
    "Classic Klondike solitaire — drag or tap to move, with animations and running statistics.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Klondike",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#14622e",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
