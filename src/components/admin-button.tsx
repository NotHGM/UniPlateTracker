// src/components/admin-button.tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogIn, Shield } from "lucide-react"

// This function checks the session status from our API route
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
        return <Button variant="ghost" size="icon" disabled className="animate-pulse bg-muted"></Button>;
    }

    return isLoggedIn ? (
        <Button variant="ghost" size="icon" asChild title="Admin Dashboard">
            <Link href="/admin">
                <Shield className="h-5 w-5" />
                <span className="sr-only">Admin Dashboard</span>
            </Link>
        </Button>
    ) : (
        <Button variant="ghost" size="icon" asChild title="Admin Login">
            <Link href="/admin/auth">
                <LogIn className="h-5 w-5" />
                <span className="sr-only">Admin Login</span>
            </Link>
        </Button>
    );
}