import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TransitOps Web",
  description: "A lightweight browser transit operations simulator.",
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
