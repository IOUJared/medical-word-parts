import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import type { ReactNode } from "react";

import { AppShell } from "../components/app-shell";
import { ProgressiveEnhancerScript } from "../components/progressive-enhancer-script";
import { publicUrl } from "../lib/paths";
import "./globals.css";

const atkinson = localFont({
  src: "../fonts/atkinson-hyperlegible-400-ui.woff2",
  variable: "--font-atkinson-loaded",
  display: "swap",
});

const atkinsonBold = localFont({
  src: "../fonts/atkinson-hyperlegible-700-ui.woff2",
  variable: "--font-atkinson-bold-loaded",
  display: "swap",
});

const crimson = localFont({
  src: "../fonts/crimson-pro-500-600-ui.woff2",
  weight: "500 600",
  variable: "--font-crimson-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env["NEXT_PUBLIC_SITE_URL"] ?? "/", "https://ioujared.github.io/medical-word-parts"),
  title: { default: "Medical Word Parts", template: "%s | Medical Word Parts" },
  description: "A sourced field guide for learning how medical terms are constructed.",
  applicationName: "Medical Word Parts",
  icons: { icon: `${process.env["NEXT_PUBLIC_BASE_PATH"] ?? ""}/icon.svg` },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "light dark" };

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  const enableDevTools = process.env["NODE_ENV"] === "development" && process.env["NEXT_PUBLIC_DISABLE_REACT_DEVTOOLS"] !== "1";
  return <html lang="en" className={`${atkinson.variable} ${atkinsonBold.variable} ${crimson.variable}`} suppressHydrationWarning><head><Script src={publicUrl("/generated/theme.js")} strategy="beforeInteractive" />{enableDevTools ? <><Script src="https://unpkg.com/react-grab/dist/index.global.js" crossOrigin="anonymous" strategy="beforeInteractive" /><Script src="https://unpkg.com/react-scan/dist/auto.global.js" crossOrigin="anonymous" strategy="beforeInteractive" /></> : null}</head><body><AppShell>{children}</AppShell><ProgressiveEnhancerScript src={publicUrl("/generated/site.js")} /></body></html>;
}
