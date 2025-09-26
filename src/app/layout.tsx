import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// @ts-ignore
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import ClientOnly from "@/components/ClientOnly";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TNTour - Tennis Tournament Management",
  description: "Professional Tennis Tournament Management Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
        suppressHydrationWarning
      >
        <ClientOnly>
          <AuthProvider>
            <div className="flex-1">
              {children}
            </div>
            <Footer />
          </AuthProvider>
        </ClientOnly>
      </body>
    </html>
  );
}
