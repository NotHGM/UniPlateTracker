import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/shell/app-shell";

const geistSans = Geist({
    variable: "--font-sans",
    subsets: ["latin"],
    display: "swap",
});

const geistMono = Geist_Mono({
    variable: "--font-mono",
    subsets: ["latin"],
    display: "swap",
});

const charlesWright = localFont({
    src: "../fonts/CharlesWright.woff2",
    display: "swap",
    variable: "--font-plate",
});

export const metadata: Metadata = {
    title: "UniPlateTracker",
    description: "A centralized dashboard for license plate monitoring.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={cn(
                    "antialiased min-h-screen",
                    geistSans.variable,
                    geistMono.variable,
                    charlesWright.variable,
                )}
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <AppShell>{children}</AppShell>
                </ThemeProvider>
            </body>
        </html>
    );
}
