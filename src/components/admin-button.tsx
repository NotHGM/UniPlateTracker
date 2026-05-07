"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogIn, Shield } from "lucide-react"

const checkAdminSession = async () => {
    try {
        const res = await fetch('/api/admin/auth/status');
        if (res.ok) {
            const data = await res.json();
            return data.isLoggedIn === true;
        }
    } catch (error) {
        console.error("Failed to check admin session:", error);
    }
    return false;
}

export function AdminButton() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkAdminSession().then(status => {
            setIsLoggedIn(status);
            setIsLoading(false);
        });
    }, []);

    if (isLoading) {
        return <Button variant="ghost" size="icon" disabled className="animate-pulse bg-muted" aria-label="Loading session" />;
    }

    return isLoggedIn ? (
        <Button variant="ghost" size="icon" asChild title="Admin dashboard">
            <Link href="/admin" aria-label="Admin dashboard">
                <Shield className="h-5 w-5" />
            </Link>
        </Button>
    ) : (
        <Button variant="ghost" size="icon" asChild title="Admin login">
            <Link href="/admin/auth" aria-label="Admin login">
                <LogIn className="h-5 w-5" />
            </Link>
        </Button>
    );
}
