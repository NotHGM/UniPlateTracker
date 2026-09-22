import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/shell/app-shell";
import { isDemoMode } from "@/lib/demo";

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

/*
 * Rendered per request rather than prerendered at build.
 *
 * This is self-hosted software configured entirely through environment
 * variables, and a statically prerendered tree freezes whatever those
 * variables happened to be inside the Docker build. That was already slightly
 * untrue for the detections page, which reads APP_REGION and
 * ENABLE_VIDEO_CAPTURE: changing either one in .env.local and restarting the
 * container had no effect, because the answer had been baked in at build
 * time and only a rebuild could change it. DEMO_MODE would have inherited the
 * same problem.
 *
 * Only the detections page and the 404 were ever static; everything else is
 * already dynamic because it reads the session or the database. So this costs
 * one server render on a page that fetches its actual data client-side
 * anyway, and in exchange the configuration file means what it says.
 */
export const dynamic = "force-dynamic";

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
                    <AppShell isDemo={isDemoMode()}>{children}</AppShell>
                </ThemeProvider>
            </body>
        </html>
    );
}
