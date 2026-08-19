"use client";

import React, { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlatesApiResponse } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DataPagination } from "./data-pagination";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import styles from "./plates.module.css";
import { ImageOff, RefreshCw, Search, VideoOff, X } from "lucide-react";
import { PlateVideoPlayer } from "./plate-video-player";

dayjs.extend(relativeTime);

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PlatesTableProps {
    initialApiData: PlatesApiResponse | null;
    error?: string | null;
    appRegion: "UK" | "INTERNATIONAL";
    internationalApiEnabled: boolean;
    videoCaptureEnabled: boolean;
}

const formatPlate = (plate: string | null): React.ReactNode => {
    if (!plate) return <>{"N/A"}</>;
    plate = plate.replace(/\s/g, "");
    if (plate.length >= 7) {
        return (
            <>
                <span>{plate.substring(0, 4)}</span>
                <span style={{ display: "inline-block", width: "0.25em" }} />
                <span>{plate.substring(4)}</span>
            </>
        );
    }
    if (plate.length === 6) {
        return (
            <>
                <span>{plate.substring(0, 3)}</span>
                <span style={{ display: "inline-block", width: "0.25em" }} />
                <span>{plate.substring(3)}</span>
            </>
        );
    }
    return <span>{plate}</span>;
};

const getStatusClass = (status: string | null): string => {
    if (!status) return styles.badgeSecondary;
    const lower = status.toLowerCase();
    if (lower === "valid" || lower === "taxed") return styles.badgeSuccess;
    if (lower.includes("expire") || lower.includes("due") || lower.includes("not taxed")) return styles.badgeDestructive;
    if (lower.includes("sorn") || lower.includes("untaxed")) return styles.badgeWarning;
    return styles.badgeSecondary;
};

const formatNumber = (n: number) => new Intl.NumberFormat("en-GB").format(n);

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
                        className="pl-9 h-10 text-base"
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

            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px] pl-6">Image</TableHead>
                            <TableHead>Plate</TableHead>
                            {showVehicleDetails && <TableHead>Vehicle</TableHead>}
                            {showVehicleDetails && <TableHead>MOT</TableHead>}
                            {showVehicleDetails && <TableHead>Tax</TableHead>}
                            {showVehicleDetails && <TableHead>Registration</TableHead>}
                            {videoCaptureEnabled && <TableHead className="w-[120px]">Video</TableHead>}
                            <TableHead className="text-left pr-6">Last seen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <AnimatePresence>
                            {plates.length > 0 ? (
                                plates.map((plate) => (
                                    <motion.tr
                                        key={plate.id}
                                        layoutId={`plate-${plate.id}`}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.25, ease: "easeOut" }}
                                        className="hover:bg-muted/40 transition-colors"
                                    >
                                        <TableCell className="pl-6 py-2">
                                            <div className="w-28 aspect-video rounded-md overflow-hidden bg-muted border">
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
                                            <div className={appRegion === "UK" ? styles.ukPlateStyle : styles.intlPlateStyle}>
                                                {formatPlate(plate.plate_number)}
                                            </div>
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
                                                    <div className={cn(styles.badge, getStatusClass(plate.mot_status))}>
                                                        {plate.mot_status || "N/A"}
                                                    </div>
                                                    {plate.mot_expiry_date && (
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            Expires {dayjs(plate.mot_expiry_date).format("DD/MM/YYYY")}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="align-middle">
                                                    <div className={cn(styles.badge, getStatusClass(plate.tax_status))}>
                                                        {plate.tax_status || "N/A"}
                                                    </div>
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
                                                    <div className="w-28 aspect-video bg-muted border rounded-md flex items-center justify-center text-muted-foreground">
                                                        <VideoOff className="w-4 h-4" />
                                                    </div>
                                                )}
                                            </TableCell>
                                        )}
                                        <TableCell className="text-left align-middle pr-6">
                                            <div className="font-semibold">{dayjs(plate.recent_capture_time).fromNow()}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {dayjs(plate.recent_capture_time).format("DD/MM/YY HH:mm")}
                                            </div>
                                        </TableCell>
                                    </motion.tr>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={showVehicleDetails ? (videoCaptureEnabled ? 8 : 7) : (videoCaptureEnabled ? 4 : 3)}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        No results found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </AnimatePresence>
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
