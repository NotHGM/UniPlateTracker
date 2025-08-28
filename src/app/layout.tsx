// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

const charlesWright = localFont({
    src: '../fonts/CharlesWright.woff2',
    display: 'swap',
    variable: '--font-charles-wright',
});

export const metadata: Metadata = {
    title: "UniPlateTracker",
    description: "A centralized dashboard for license plate monitoring.",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
        <body
            className={cn(
                "antialiased",
                geistSans.variable,
                geistMono.variable,
                charlesWright.variable
            )}
        >
        {children}
        </body>
        </html>
    );
}