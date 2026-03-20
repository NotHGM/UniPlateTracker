// src/components/admin/logout-button.tsx
"use client"

import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useState } from 'react';

export function LogoutButton() {
    const [isLoading, setIsLoading] = useState(false);

    const handleLogout = async () => {
        if (isLoading) {
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('/api/admin/auth/logout', {
                method: 'POST',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error('Logout failed');
            }

            // Use a hard redirect so server-side auth checks re-run immediately.
            window.location.assign('/admin/auth');
        } catch (error) {
            console.error(error);
            setIsLoading(false);
        }
    };

    return (
        <Button variant="ghost" size="icon" onClick={handleLogout} disabled={isLoading}>
            <LogOut className="h-5 w-5" />
            <span className="sr-only">Sign Out</span>
        </Button>
    );
}