import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentraMessaging · CipherCore",
  description: "Zero-Knowledge Post-Quantum Secured Messaging — Powered by PQXDH + Double Ratchet",
  keywords: ["post-quantum", "zero-knowledge", "messaging", "kyber-768", "x25519"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
