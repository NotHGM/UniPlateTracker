"use client";

import useSWR from "swr";

interface SessionStatus {
    isLoggedIn: boolean;
    isLoading: boolean;
}

/**
 * Whether an admin session is active.
 *
 * Shared through SWR rather than fetched per component. The header needs this
 * in two places at once — to decide whether to offer the Admin link, and to
 * choose between a sign-in and a sign-out control — and two independent
 * fetches of the same endpoint can disagree for a frame and flicker.
 */
export function useAdminSession(): SessionStatus {
    const { data, isLoading } = useSWR(
        "/api/admin/auth/status",
        async (url: string) => {
            const res = await fetch(url);
            if (!res.ok) return { isLoggedIn: false };
            return res.json();
        },
        {
            revalidateOnFocus: true,
            shouldRetryOnError: false,
        },
    );

    return { isLoggedIn: data?.isLoggedIn === true, isLoading };
}
