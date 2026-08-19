"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlatesApiResponse } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { DataPagination } from "./data-pagination";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, ImageOff, RefreshCw, Search, VideoOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlateVideoPlayer } from "./plate-video-player";
import { PlateCard } from "./plate-card";
import { PlateTag, StatusBadge } from "./plate-format";

dayjs.extend(relativeTime);

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PlatesTableProps {
    initialApiData: PlatesApiResponse | null;
    error?: string | null;
    appRegion: "UK" | "INTERNATIONAL";
    internationalApiEnabled: boolean;
    videoCaptureEnabled: boolean;
}

const formatNumber = (n: number) => new Intl.NumberFormat("en-GB").format(n);

type SortKey = "seen" | "plate" | "make" | "year" | "mot" | "tax";
type SortDir = "asc" | "desc";

/**
 * Two different nothings.
 *
 * An empty table previously said "No results found" regardless of cause, which
 * conflates a fresh install with a dead-end filter combination. They call for
 * opposite responses: one means wait for the cameras, the other means the way
 * out is to widen the filters, so the way out is offered directly.
 */
function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
    if (!hasFilters) {
        return (
            <div className="text-center space-y-1">
                <p className="font-medium">No detections yet</p>
                <p className="text-sm text-muted-foreground">
                    Plates will appear here as your cameras report them.
                </p>
            </div>
        );
    }

    return (
        <div className="text-center space-y-2">
            <div className="space-y-1">
                <p className="font-medium">No matching detections</p>
                <p className="text-sm text-muted-foreground">
                    No plate matches every filter you have applied.
                </p>
            </div>
            <Button variant="outline" size="sm" onClick={onClear}>
                Clear filters
            </Button>
        </div>
    );
}

/**
 * A column header that sorts.
 *
 * Rendered as a real button inside the th rather than a click handler on the
 * th itself, so it is reachable by keyboard and announced as an interactive
 * control. aria-sort on the header cell is what tells a screen reader which
 * column the table is currently ordered by, and in which direction — the
 * arrow glyph alone communicates that to sighted users only.
 */
function SortableHead({
    label,
    sortKey,
    activeSort,
    activeDir,
    onSort,
    className,
}: {
    label: string;
    sortKey: SortKey;
    activeSort: SortKey;
    activeDir: SortDir;
    onSort: (key: SortKey) => void;
    className?: string;
}) {
    const isActive = activeSort === sortKey;

    return (
        <TableHead
            className={className}
            aria-sort={isActive ? (activeDir === "asc" ? "ascending" : "descending") : "none"}
        >
            <button
                type="button"
                onClick={() => onSort(sortKey)}
                className={cn(
                    "inline-flex items-center gap-1 rounded-sm -mx-1 px-1 py-0.5 transition-colors",
                    "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    isActive ? "text-foreground" : "text-muted-foreground",
                )}
            >
                {label}
                {isActive ? (
                    activeDir === "asc" ? (
                        <ArrowUp className="h-3 w-3" aria-hidden />
                    ) : (
                        <ArrowDown className="h-3 w-3" aria-hidden />
                    )
                ) : (
                    <ChevronsUpDown className="h-3 w-3 opacity-40" aria-hidden />
                )}
            </button>
        </TableHead>
    );
}

type FilterKey = "make" | "color" | "year" | "mot" | "tax";

/**
 * A labelled filter dropdown.
 *
 * Radix renders its trigger as a button whose only content is the selected
 * value, so a trigger showing "All makes" announces as an unnamed button —
 * the control has no name at all until you already know what it filters.
 *
 * The name has to carry the visible text as well as the field, not replace
 * it. WCAG 2.5.3 requires the accessible name to contain the visible label,
 * so that someone using voice control can say what they can see: with a bare
 * aria-label of "Filter by make", saying "click all makes" matches nothing.
 * Composing the two gives "Filter by make: All makes", which satisfies both
 * the screen reader and the voice user.
 */
function FilterSelect({
    label,
    anyLabel,
    options,
    value,
    onChange,
}: {
    label: string;
    anyLabel: string;
    options: readonly string[];
    value: string;
    onChange: (value: string) => void;
}) {
    const visibleText = value && value !== "all" ? value : anyLabel;

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-full h-9" aria-label={`${label}: ${visibleText}`}>
                <SelectValue placeholder={anyLabel} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">{anyLabel}</SelectItem>
                {options.map((option) => (
                    <SelectItem key={option} value={option}>
                        {option}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

export function PlatesTable({
    initialApiData,
    error,
    appRegion,
    internationalApiEnabled,
    videoCaptureEnabled,
}: PlatesTableProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const initialFilters = useMemo(
        () => ({
            search: searchParams.get("search") || "",
            make: searchParams.get("make") || "all",
            color: searchParams.get("color") || "all",
            year: searchParams.get("year") || "all",
            mot: searchParams.get("mot") || "all",
            tax: searchParams.get("tax") || "all",
        }),
        [searchParams],
    );

    const [filters, setFilters] = useState(initialFilters);
    const [displayedPlates, setDisplayedPlates] = useState(initialApiData?.data ?? []);
    const [lastCheckedTimestamp, setLastCheckedTimestamp] = useState(initialApiData?.lastCheckedTimestamp);
    const [showUpdateNotice, setShowUpdateNotice] = useState(false);

    useEffect(() => {
        setDisplayedPlates(initialApiData?.data ?? []);
        setLastCheckedTimestamp(initialApiData?.lastCheckedTimestamp);
        setShowUpdateNotice(false);
    }, [initialApiData]);

    const { data: updateData } = useSWR("/api/check-update", { refreshInterval: 5000, fetcher });

    useEffect(() => {
        if (!updateData?.lastUpdate || !lastCheckedTimestamp) return;
        const isNewDataAvailable = new Date(updateData.lastUpdate) > new Date(lastCheckedTimestamp);
        if (isNewDataAvailable) {
            let hasActiveFilters = false;
            searchParams.forEach((value, key) => {
                if (key !== "page") hasActiveFilters = true;
            });
            const isOnAnotherPage = searchParams.has("page") && searchParams.get("page") !== "1";
            if (!isOnAnotherPage && !hasActiveFilters) router.refresh();
            else setShowUpdateNotice(true);
        }
    }, [updateData, lastCheckedTimestamp, router, searchParams]);

    useEffect(() => {
        const timer = setTimeout(() => {
            const currentParams = new URLSearchParams(searchParams.toString());
            const searchInUrl = currentParams.get("search") || "";
            if (filters.search !== searchInUrl) {
                const newParams = new URLSearchParams(searchParams.toString());
                if (filters.search) newParams.set("search", filters.search);
                else newParams.delete("search");
                newParams.set("page", "1");
                router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [filters.search, pathname, router, searchParams]);

    const handleApplyFilters = () => {
        const current = new URLSearchParams(searchParams.toString());
        const { search: _search, ...dropdownFilters } = filters;
        Object.entries(dropdownFilters).forEach(([key, value]) => {
            if (value && value !== "all") current.set(key, value);
            else current.delete(key);
        });
        current.set("page", "1");
        router.push(`${pathname}?${current.toString()}`, { scroll: false });
    };

    const handleClearFilters = () => {
        router.push(pathname, { scroll: false });
        setFilters({ search: "", make: "all", color: "all", year: "all", mot: "all", tax: "all" });
    };

    const handleShowNewPlates = () => router.push(pathname);

    const activeSort = (searchParams.get("sort") as SortKey) || "seen";
    const activeDir = (searchParams.get("dir") as SortDir) || "desc";

    /**
     * Clicking the active column flips direction; clicking a new one starts
     * descending, because for every column here the interesting end is the
     * recent or the largest. Sorting always returns to page one — staying on
     * page 12 of a freshly reordered set puts you somewhere arbitrary.
     */
    const handleSort = (key: SortKey) => {
        const params = new URLSearchParams(searchParams.toString());
        const nextDir: SortDir = activeSort === key && activeDir === "desc" ? "asc" : "desc";

        params.set("sort", key);
        params.set("dir", nextDir);
        params.set("page", "1");
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const showVehicleDetails = appRegion === "UK" || internationalApiEnabled;
    const pagination = initialApiData?.pagination ?? { currentPage: 1, totalPages: 0, totalRows: 0 };
    const filterOptions = initialApiData?.filterOptions ?? { makes: [], colors: [], years: [], motStatuses: [], taxStatuses: [] };
    const plates = displayedPlates;

    const activeFilterCount =
        Object.entries(filters).filter(([k, v]) => k !== "search" && v && v !== "all").length +
        (filters.search ? 1 : 0);

    const filterFields = useMemo(
        () =>
            [
                { key: "make", label: "Filter by make", anyLabel: "All makes", options: filterOptions.makes },
                { key: "color", label: "Filter by colour", anyLabel: "All colors", options: filterOptions.colors },
                {
                    key: "year",
                    label: "Filter by year of manufacture",
                    anyLabel: "All years",
                    options: filterOptions.years.map(String),
                },
                { key: "mot", label: "Filter by MOT status", anyLabel: "All MOT", options: filterOptions.motStatuses },
                { key: "tax", label: "Filter by tax status", anyLabel: "All tax", options: filterOptions.taxStatuses },
            ] satisfies readonly { key: FilterKey; label: string; anyLabel: string; options: readonly string[] }[],
        [filterOptions],
    );

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-4">
            <Card className="p-4 sm:p-5 gap-4">
                <div className="relative">
                    <label htmlFor="plate-search" className="sr-only">
                        Search license plates
                    </label>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                    <Input
                        id="plate-search"
                        type="search"
                        placeholder="Search for a license plate..."
                        value={filters.search}
                        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                        className="pl-9 h-9"
                    />
                    {filters.search && (
                        <button
                            onClick={() => setFilters((f) => ({ ...f, search: "" }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Clear search"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {showVehicleDetails && (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                            {filterFields.map((field) => (
                                <FilterSelect
                                    key={field.key}
                                    label={field.label}
                                    anyLabel={field.anyLabel}
                                    options={field.options}
                                    value={filters[field.key]}
                                    onChange={(v) => setFilters((f) => ({ ...f, [field.key]: v }))}
                                />
                            ))}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <div className="text-sm text-muted-foreground">
                                {activeFilterCount > 0
                                    ? `${activeFilterCount} active ${activeFilterCount === 1 ? "filter" : "filters"} · ${formatNumber(pagination.totalRows)} results`
                                    : `${formatNumber(pagination.totalRows)} results`}
                            </div>
                            <div className="flex items-center gap-2">
                                {/*
                                  * Exports the whole matching set, not the page
                                  * on screen, so it carries the same query the
                                  * table was built from. A plain link rather
                                  * than a fetch, so the browser streams it
                                  * straight to disk instead of buffering a
                                  * potentially very large file in memory.
                                  */}
                                <Button variant="ghost" size="sm" asChild>
                                    <a
                                        href={`/api/plates/export?${searchParams.toString()}`}
                                        download
                                        title={`Download all ${formatNumber(pagination.totalRows)} matching detections as CSV`}
                                    >
                                        <Download className="h-4 w-4 mr-1.5" aria-hidden />
                                        Export
                                    </a>
                                </Button>
                                <Button onClick={handleClearFilters} variant="ghost" size="sm" disabled={activeFilterCount === 0}>
                                    Clear
                                </Button>
                                <Button onClick={handleApplyFilters} size="sm">
                                    Apply filters
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </Card>

            <AnimatePresence>
                {showUpdateNotice && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <Button className="w-full" onClick={handleShowNewPlates}>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            New detections available
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/*
              * Below md the table becomes a card list rather than a scrolling
              * table. See plate-card.tsx for why reflowing beats scrolling here.
              */}
            <div className="md:hidden rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                {plates.length > 0 ? (
                    <ul className="divide-y">
                        {plates.map((plate) => (
                            <PlateCard
                                key={plate.id}
                                plate={plate}
                                appRegion={appRegion}
                                showVehicleDetails={showVehicleDetails}
                                videoCaptureEnabled={videoCaptureEnabled}
                            />
                        ))}
                    </ul>
                ) : (
                    <div className="py-10 px-4">
                        <EmptyState hasFilters={activeFilterCount > 0} onClear={handleClearFilters} />
                    </div>
                )}
            </div>

            <div className="hidden md:block rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                {/*
                  * The table body scrolls inside its own viewport rather than
                  * with the page, which is what makes the pinned header work.
                  *
                  * Setting overflow on one axis forces the other to auto, so
                  * the horizontal-scroll wrapper this component already had was
                  * silently becoming the sticky containing block. Because that
                  * wrapper never scrolled vertically, a header stuck to it
                  * never engaged and simply scrolled away with the page.
                  *
                  * Giving the wrapper a bounded height and both axes makes it a
                  * real scroll container, so top-0 pins against something that
                  * actually moves. It also keeps the filter bar on screen while
                  * paging through rows, which is the behaviour you want when
                  * narrowing 4,279 detections.
                  */}
                <Table containerClassName="max-h-[calc(100vh-15rem)] overflow-auto">
                    <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
                        <TableRow>
                            <TableHead className="w-[104px] pl-4">Image</TableHead>
                            <SortableHead label="Plate" sortKey="plate" activeSort={activeSort} activeDir={activeDir} onSort={handleSort} />
                            {showVehicleDetails && (
                                <SortableHead label="Vehicle" sortKey="make" activeSort={activeSort} activeDir={activeDir} onSort={handleSort} />
                            )}
                            {showVehicleDetails && (
                                <SortableHead label="MOT" sortKey="mot" activeSort={activeSort} activeDir={activeDir} onSort={handleSort} />
                            )}
                            {showVehicleDetails && (
                                <SortableHead label="Tax" sortKey="tax" activeSort={activeSort} activeDir={activeDir} onSort={handleSort} />
                            )}
                            {showVehicleDetails && (
                                <SortableHead label="Registration" sortKey="year" activeSort={activeSort} activeDir={activeDir} onSort={handleSort} />
                            )}
                            {videoCaptureEnabled && <TableHead className="w-[104px]">Video</TableHead>}
                            <SortableHead label="Last seen" sortKey="seen" activeSort={activeSort} activeDir={activeDir} onSort={handleSort} className="pr-4" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {/*
                          * Rows are not animated. A monitoring table refreshes
                          * on its own and can hold hundreds of rows, so a
                          * per-row enter and exit means the list is in motion
                          * whenever new detections arrive — which is exactly
                          * when someone is trying to read it. Animating a
                          * high-frequency list costs legibility and layout
                          * work and buys nothing.
                          */}
                        {plates.length > 0 ? (
                            plates.map((plate) => (
                                    <TableRow key={plate.id}>
                                        <TableCell className="pl-4 py-1.5">
                                            <div className="w-20 aspect-video rounded overflow-hidden bg-muted border">
                                                {plate.image_url ? (
                                                    <img
                                                        src={plate.image_url}
                                                        alt={`Capture of ${plate.plate_number}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                        <ImageOff className="h-4 w-4" />
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="align-middle">
                                            <PlateTag plateNumber={plate.plate_number} appRegion={appRegion} />
                                        </TableCell>
                                        {showVehicleDetails && (
                                            <>
                                                <TableCell className="align-middle">
                                                    <div className="font-semibold">{plate.car_make || "N/A"}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {plate.car_color || "N/A"} • {plate.fuel_type || "N/A"}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="align-middle">
                                                    <StatusBadge status={plate.mot_status} />
                                                    {plate.mot_expiry_date && (
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            Expires {dayjs(plate.mot_expiry_date).format("DD/MM/YYYY")}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="align-middle">
                                                    <StatusBadge status={plate.tax_status} />
                                                    {plate.tax_due_date && (
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            Due {dayjs(plate.tax_due_date).format("DD/MM/YYYY")}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="align-middle">
                                                    <div className="font-semibold">{plate.year_of_manufacture || "N/A"}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {plate.month_of_first_registration
                                                            ? `Reg: ${dayjs(plate.month_of_first_registration).format("MMM YYYY")}`
                                                            : "N/A"}
                                                    </div>
                                                </TableCell>
                                            </>
                                        )}
                                        {videoCaptureEnabled && (
                                            <TableCell className="align-middle">
                                                {plate.video_url ? (
                                                    <PlateVideoPlayer
                                                        videoUrl={plate.video_url}
                                                        plateNumber={plate.plate_number}
                                                        appRegion={appRegion}
                                                    />
                                                ) : (
                                                    <div className="w-20 aspect-video bg-muted border rounded flex items-center justify-center text-muted-foreground">
                                                        <VideoOff className="w-4 h-4" aria-hidden />
                                                        <span className="sr-only">No clip expected</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                        )}
                                        <TableCell className="text-left align-middle pr-4">
                                            <div className="font-medium">{dayjs(plate.recent_capture_time).fromNow()}</div>
                                            <time
                                                dateTime={dayjs(plate.recent_capture_time).toISOString()}
                                                className="text-xs text-muted-foreground"
                                            >
                                                {dayjs(plate.recent_capture_time).format("DD/MM/YY HH:mm")}
                                            </time>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={showVehicleDetails ? (videoCaptureEnabled ? 8 : 7) : (videoCaptureEnabled ? 4 : 3)}
                                        className="py-10"
                                    >
                                        <EmptyState
                                            hasFilters={activeFilterCount > 0}
                                            onClear={handleClearFilters}
                                        />
                                    </TableCell>
                                </TableRow>
                            )}
                    </TableBody>
                </Table>
            </div>

            {pagination.totalPages > 1 && (
                <div className="flex justify-end mt-4">
                    <DataPagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} />
                </div>
            )}
        </div>
    );
}
