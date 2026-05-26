import type { Metadata } from "next";
import Script from "next/script";
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
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="technote-theme-init" strategy="beforeInteractive">
          {`
try {
  var theme = window.localStorage.getItem("technote.theme") || "system";
  var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && prefersDark));
} catch {}
          `.trim()}
        </Script>
        {children}
      </body>
    </html>
  );
}
