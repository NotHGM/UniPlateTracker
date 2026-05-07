"use client";

import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { useState } from "react";

export function LogoutButton() {
    const [isLoading, setIsLoading] = useState(false);

    const handleLogout = async () => {
        if (isLoading) return;
        setIsLoading(true);
        try {
            const response = await fetch("/api/admin/auth/logout", {
                method: "POST",
                credentials: "same-origin",
            });
            if (!response.ok) throw new Error("Logout failed");
            window.location.assign("/admin/auth");
        } catch (error) {
            console.error(error);
            setIsLoading(false);
        }
    };

    return (
        <Button variant="ghost" size="icon" onClick={handleLogout} disabled={isLoading} title="Sign out">
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
            <span className="sr-only">Sign out</span>
        </Button>
    );
}
