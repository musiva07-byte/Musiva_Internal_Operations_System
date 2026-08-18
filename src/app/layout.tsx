import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Moosiva Internal Operations System",
    template: "%s | Moosiva Internal Operations System",
  },
  description: "Private operations system for Moosiva Lux Wear.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
