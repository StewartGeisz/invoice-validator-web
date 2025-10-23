import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Invoice Validation System",
  description: "Automated Oracle invoice validation against service agreements",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}