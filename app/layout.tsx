import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOQ Pool — Manufacturer Console",
  description: "Manufacturer SaaS MVP for MOQ Pool",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        />
        <link rel="stylesheet" href="/css/styles.css" />
        <link rel="stylesheet" href="/css/manufacturer.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
