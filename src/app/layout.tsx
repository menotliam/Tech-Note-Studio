import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TechNote Studio",
  description: "Technical-first notes for code, commands, SQL, JSON, and exports."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
