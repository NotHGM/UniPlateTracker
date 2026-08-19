"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { LogoutButton } from "@/components/admin/logout-button";
import { useAdminSession } from "./use-admin-session";

/**
 * The chrome that persists across every screen.
 *
 * Before this existed the public view and the admin area each assembled their
 * own layout, and the only things bridging them were two icon buttons that
 * floated in whichever corner the page remembered to put them. Moving between
 * the two felt like leaving one product and arriving at another.
 *
 * Top navigation rather than a sidebar. There are few destinations, and the
 * plates table is eight columns wide — horizontal space is the scarce
 * resource on this surface, so spending 240px of it permanently on three
 * links would be the wrong trade.
 */

const NAV_ITEMS = [
    { href: "/", label: "Detections", adminOnly: false },
    { href: "/admin", label: "Admin", adminOnly: true },
] as const;

/**
 * The wordmark, set as a registration plate.
 *
 * The signature detail of the interface. The product is about plates, the
 * Charles Wright typeface is already loaded for the table, and using it here
 * costs nothing and gives the application an identity no dashboard template
 * has. It is a real plate face rather than an approximation of one.
 */
function Wordmark() {
    return (
        <Link href="/" className="flex items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <span className="plate plate-uk text-sm" aria-hidden>
                UPT
            </span>
            <span className="font-semibold tracking-tight hidden sm:inline">UniPlateTracker</span>
            <span className="sr-only">UniPlateTracker, go to detections</span>
        </Link>
    );
}

function NavLinks({ isLoggedIn }: { isLoggedIn: boolean }) {
    const pathname = usePathname();

    return (
        <nav aria-label="Main" className="flex items-center gap-1">
            {NAV_ITEMS.filter((item) => !item.adminOnly || isLoggedIn).map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                            "px-2.5 py-1.5 text-sm rounded-md transition-colors",
                            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            isActive
                                ? "bg-secondary text-secondary-foreground font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                        )}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { isLoggedIn, isLoading } = useAdminSession();

    /*
     * The sign-in screen deliberately gets no navigation. Offering links to
     * places the visitor cannot reach yet is noise, and a bare auth screen is
     * also a clearer statement that they are at a boundary.
     */
    const isAuthScreen = pathname === "/admin/auth";

    if (isAuthScreen) {
        return <div className="bg-background min-h-screen">{children}</div>;
    }

    return (
        <div className="bg-background min-h-screen flex flex-col">
            <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-sm supports-[backdrop-filter]:bg-background/70">
                <div className="mx-auto max-w-[1600px] px-4 sm:px-6 h-14 flex items-center gap-4">
                    <Wordmark />

                    <div className="h-5 w-px bg-border hidden sm:block" aria-hidden />

                    <NavLinks isLoggedIn={isLoggedIn} />

                    <div className="ml-auto flex items-center gap-1.5">
                        <ModeToggle />
                        {/*
                          * Nothing is rendered until the session is known. A
                          * sign-in button that flips to sign-out a moment
                          * later is worse than a brief gap, because the first
                          * state is a lie about who you are.
                          */}
                        {isLoading ? (
                            <div className="size-9" aria-hidden />
                        ) : isLoggedIn ? (
                            <LogoutButton />
                        ) : (
                            <Button variant="ghost" size="icon" asChild title="Admin sign in">
                                <Link href="/admin/auth" aria-label="Admin sign in">
                                    <LogIn className="h-5 w-5" />
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 mx-auto w-full max-w-[1600px] px-4 sm:px-6 py-6">{children}</main>
        </div>
    );
}

/**
 * A page title and its supporting line.
 *
 * Exists so the two surfaces cannot drift apart on type scale and spacing the
 * way they had before, when each page hardcoded its own heading.
 */
export function PageHeader({
    title,
    description,
    actions,
}: {
    title: string;
    description?: React.ReactNode;
    actions?: React.ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div className="space-y-0.5">
                <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    );
}
