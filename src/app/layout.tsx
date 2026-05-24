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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
try {
  var theme = window.localStorage.getItem("technote.theme") || "system";
  var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && prefersDark));
} catch {}
            `.trim()
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
