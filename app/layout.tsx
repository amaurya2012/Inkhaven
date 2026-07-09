import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Serif_4, Inter } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const editorFont = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-editor",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const uiFont = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Inkhaven — a quiet place to write your book",
  description:
    "A distraction-free, offline-first writing app for novelists. Your manuscript, your characters, your world — all in one cozy desk.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Inkhaven",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#8B5E3C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${displayFont.variable} ${editorFont.variable} ${uiFont.variable} font-sans antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
