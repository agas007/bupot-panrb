import type { Metadata } from "next";
import "./globals.css";
import { Layout } from "@/components/layout/Layout";
import { LanguageProvider } from "@/components/LanguageProvider";

export const metadata: Metadata = {
  title: "e-Bupot PANRB",
  description: "Collaborative tax withholding monitoring system for office colleagues.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <Layout>{children}</Layout>
        </LanguageProvider>
      </body>
    </html>
  );
}
