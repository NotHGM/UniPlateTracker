"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";

interface DataPaginationProps {
    currentPage: number;
    totalPages: number;
}

/**
 * Paging for a set large enough that stepping through it is not an option.
 *
 * With 4,279 detections at ten per page this control spans 428 pages, and it
 * previously offered only previous and next. Reaching anything older than the
 * last few hours meant hundreds of clicks, which in practice means the older
 * data was unreachable.
 *
 * So: first and last jump to the ends, and the page number is a field you can
 * type into. Rendering 428 numbered links would be worse than either.
 */
export function DataPagination({ currentPage, totalPages }: DataPaginationProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [pageInput, setPageInput] = useState(String(currentPage));

    /*
     * The field mirrors the URL rather than owning it. Paging can also happen
     * through the arrows, a filter change resetting to page one, or the back
     * button, and without this the field would keep showing a stale number
     * after any of them.
     */
    useEffect(() => {
        setPageInput(String(currentPage));
    }, [currentPage]);

    const goToPage = (page: number) => {
        const target = Math.min(Math.max(page, 1), totalPages);
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(target));
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const commitPageInput = () => {
        const parsed = Number.parseInt(pageInput, 10);

        // Reject anything unparseable by snapping the field back, rather than
        // navigating to NaN and emptying the table.
        if (!Number.isFinite(parsed)) {
            setPageInput(String(currentPage));
            return;
        }

        goToPage(parsed);
    };

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => goToPage(1)}
                    disabled={currentPage <= 1}
                    title="First page"
                >
                    <ChevronsLeftIcon className="h-4 w-4" aria-hidden />
                    <span className="sr-only">First page</span>
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    title="Previous page"
                >
                    <ChevronLeftIcon className="h-4 w-4" aria-hidden />
                    <span className="sr-only">Previous page</span>
                </Button>
            </div>

            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <label htmlFor="page-number" className="sr-only">
                    Page number
                </label>
                <Input
                    id="page-number"
                    inputMode="numeric"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={commitPageInput}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") commitPageInput();
                    }}
                    className="h-8 w-14 text-center tabular-nums"
                />
                <span className="whitespace-nowrap">
                    of <span className="tabular-nums">{totalPages}</span>
                </span>
            </div>

            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    title="Next page"
                >
                    <ChevronRightIcon className="h-4 w-4" aria-hidden />
                    <span className="sr-only">Next page</span>
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage >= totalPages}
                    title="Last page"
                >
                    <ChevronsRightIcon className="h-4 w-4" aria-hidden />
                    <span className="sr-only">Last page</span>
                </Button>
            </div>
        </div>
    );
}
