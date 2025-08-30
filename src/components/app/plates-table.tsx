// src/components/app/plates-table.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LicensePlate, PlatesApiResponse } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { DataPagination } from "./data-pagination";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from 'swr';
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import styles from "./plates.module.css";
import { RefreshCw } from "lucide-react";

dayjs.extend(relativeTime);

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface PlatesTableProps {
    initialApiData: PlatesApiResponse | null;
    error?: string | null;
    appRegion: 'UK' | 'INTERNATIONAL';
    internationalApiEnabled: boolean;
}

const formatPlate = (plate: string | null): JSX.Element => {
    if (!plate) return <>{'N/A'}</>;
    plate = plate.replace(/\s/g, '');

    if (plate.length === 7) {
        return <><span>{plate.substring(0, 4)}</span><span>{plate.substring(4)}</span></>;
    }

    if (plate.length === 6) {
        return <><span>{plate.substring(0, 3)}</span><span>{plate.substring(3)}</span></>;
    }

    return <span>{plate}</span>;
};

const getStatusClass = (status: string | null): string => {
    if (!status) return styles.badgeSecondary;
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'valid' || lowerStatus === 'taxed') return styles.badgeSuccess;
    if (lowerStatus.includes('expire') || lowerStatus.includes('due') || lowerStatus.includes('not taxed')) return styles.badgeDestructive;
    return styles.badgeSecondary;
};

export function PlatesTable({ initialApiData, error, appRegion, internationalApiEnabled }: PlatesTableProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [filters, setFilters] = useState({
        search: searchParams.get('search') || '',
        make: searchParams.get('make') || 'all',
        color: searchParams.get('color') || 'all',
        year: searchParams.get('year') || 'all',
        mot: searchParams.get('mot') || 'all',
        tax: searchParams.get('tax') || 'all',
    });

    const [displayedPlates, setDisplayedPlates] = useState(initialApiData?.data ?? []);
    const [lastCheckedTimestamp, setLastCheckedTimestamp] = useState(initialApiData?.lastCheckedTimestamp);
    const [showUpdateNotice, setShowUpdateNotice] = useState(false);

    useEffect(() => {
        setDisplayedPlates(initialApiData?.data ?? []);
        setLastCheckedTimestamp(initialApiData?.lastCheckedTimestamp);
        setShowUpdateNotice(false);
    }, [initialApiData]);

    const { data: updateData } = useSWR('/api/check-update', { refreshInterval: 5000, fetcher });

    useEffect(() => {
        if (!updateData?.lastUpdate || !lastCheckedTimestamp) return;
        const isNewDataAvailable = new Date(updateData.lastUpdate) > new Date(lastCheckedTimestamp);
        if (isNewDataAvailable) {
            const hasActiveFilters = [...searchParams.keys()].some(k => k !== 'page');
            const isOnAnotherPage = searchParams.has('page') && searchParams.get('page') !== '1';
            if (!isOnAnotherPage && !hasActiveFilters) { router.refresh(); }
            else { setShowUpdateNotice(true); }
        }
    }, [updateData, lastCheckedTimestamp, router, searchParams]);

    useEffect(() => {
        const timer = setTimeout(() => {
            const current = new URLSearchParams(searchParams.toString());
            if (filters.search) {
                current.set("search", filters.search);
            } else {
                current.delete("search");
            }
            current.set("page", "1");
            router.push(`${pathname}?${current.toString()}`, { scroll: false });
        }, 500);
        return () => clearTimeout(timer);
    }, [filters.search]);

    const handleApplyFilters = () => {
        const current = new URLSearchParams(searchParams.toString());
        const { search, ...dropdownFilters } = filters;
        Object.entries(dropdownFilters).forEach(([key, value]) => {
            if (value && value !== 'all') {
                current.set(key, value);
            } else {
                current.delete(key);
            }
        });
        current.set("page", "1");
        router.push(`${pathname}?${current.toString()}`, { scroll: false });
    };

    const handleClearFilters = () => {
        router.push(pathname, { scroll: false });
        setFilters({ search: '', make: 'all', color: 'all', year: 'all', mot: 'all', tax: 'all' });
    };

    const handleShowNewPlates = () => { router.push(pathname); };

    const showVehicleDetails = appRegion === 'UK' || internationalApiEnabled;
    const pagination = initialApiData?.pagination ?? { currentPage: 1, totalPages: 0 };
    const filterOptions = initialApiData?.filterOptions ?? { makes: [], colors: [], years: [] };
    const plates = displayedPlates;

    if (error) return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;

    return (
        <div className="space-y-4">
            <div className="p-4 bg-card border rounded-lg space-y-4">
                <Input placeholder="Search for a license plate..." value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} className="text-base" />

                {showVehicleDetails && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={filters.make} onValueChange={(v) => setFilters(f => ({ ...f, make: v }))}>
                            <SelectTrigger className="flex-1 min-w-[120px]"><SelectValue placeholder="All Makes" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Makes</SelectItem>{filterOptions.makes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={filters.color} onValueChange={(v) => setFilters(f => ({ ...f, color: v }))}>
                            <SelectTrigger className="flex-1 min-w-[120px]"><SelectValue placeholder="All Colors" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Colors</SelectItem>{filterOptions.colors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={filters.year} onValueChange={(v) => setFilters(f => ({ ...f, year: v }))}>
                            <SelectTrigger className="flex-1 min-w-[120px]"><SelectValue placeholder="All Years" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Years</SelectItem>{filterOptions.years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={filters.mot} onValueChange={(v) => setFilters(f => ({ ...f, mot: v }))}>
                            <SelectTrigger className="flex-1 min-w-[120px]"><SelectValue placeholder="All MOT" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All MOT</SelectItem><SelectItem value="Valid">Valid</SelectItem><SelectItem value="Expired">Expired</SelectItem></SelectContent>
                        </Select>
                        <Select value={filters.tax} onValueChange={(v) => setFilters(f => ({ ...f, tax: v }))}>
                            <SelectTrigger className="flex-1 min-w-[120px]"><SelectValue placeholder="All Tax" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Tax</SelectItem><SelectItem value="Taxed">Taxed</SelectItem><SelectItem value="Not Taxed">Not Taxed</SelectItem></SelectContent>
                        </Select>
                        <div className="flex-grow"></div> {/* Spacer */}
                        <div className="flex gap-2">
                            <Button onClick={handleApplyFilters}>Apply Filters</Button>
                            <Button onClick={handleClearFilters} variant="ghost" className="text-muted-foreground">Clear</Button>
                        </div>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {showUpdateNotice && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pb-4">
                        <Button className="w-full" onClick={handleShowNewPlates}><RefreshCw className="mr-2 h-4 w-4 animate-spin" />New Detections Available - Click to Show</Button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="rounded-lg border bg-card text-card-foreground">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px] pl-6">Image</TableHead>
                            <TableHead>Plate</TableHead>
                            {showVehicleDetails && <TableHead>Vehicle Details</TableHead>}
                            {showVehicleDetails && <TableHead>MOT</TableHead>}
                            {showVehicleDetails && <TableHead>Tax</TableHead>}
                            {showVehicleDetails && <TableHead>Registration</TableHead>}
                            <TableHead className="text-left pr-6">Last Seen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <AnimatePresence>
                            {plates.length > 0 ? (
                                plates.map((plate) => (
                                    <motion.tr key={plate.id} layoutId={`plate-${plate.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
                                        <TableCell className="pl-6 py-2">
                                            <div className="w-28 aspect-video rounded-md overflow-hidden bg-muted">
                                                {plate.image_url ? (<img src={plate.image_url} alt={`Capture of ${plate.plate_number}`} className="w-full h-full object-cover"/>) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell className="align-middle">
                                            <div className={appRegion === 'UK' ? styles.ukPlateStyle : styles.intlPlateStyle}>
                                                {formatPlate(plate.plate_number)}
                                            </div>
                                        </TableCell>

                                        {showVehicleDetails && (
                                            <>
                                                <TableCell className="align-middle"><div className="font-semibold">{plate.car_make || 'N/A'}</div><div className="text-sm text-muted-foreground">{plate.car_color || 'N/A'} • {plate.fuel_type || 'N/A'}</div></TableCell>
                                                <TableCell className="align-middle"><div className={cn(styles.badge, getStatusClass(plate.mot_status))}>{plate.mot_status || 'N/A'}</div>{plate.mot_expiry_date && <div className="text-xs text-muted-foreground mt-1">Expires {dayjs(plate.mot_expiry_date).format('DD/MM/YYYY')}</div>}</TableCell>
                                                <TableCell className="align-middle"><div className={cn(styles.badge, getStatusClass(plate.tax_status))}>{plate.tax_status || 'N/A'}</div>{plate.tax_due_date && <div className="text-xs text-muted-foreground mt-1">Due {dayjs(plate.tax_due_date).format('DD/MM/YYYY')}</div>}</TableCell>
                                                <TableCell className="align-middle"><div className="font-semibold">{plate.year_of_manufacture || 'N/A'}</div><div className="text-sm text-muted-foreground">{plate.month_of_first_registration ? `Reg: ${dayjs(plate.month_of_first_registration).format('MMM YYYY')}` : 'N/A'}</div></TableCell>
                                            </>
                                        )}

                                        <TableCell className="text-left align-middle pr-6">
                                            <div className="font-semibold">{dayjs(plate.recent_capture_time).fromNow()}</div>
                                            <div className="text-xs text-muted-foreground">{dayjs(plate.recent_capture_time).format('DD/MM/YY HH:mm')}</div>
                                        </TableCell>
                                    </motion.tr>
                                ))
                            ) : ( <TableRow><TableCell colSpan={showVehicleDetails ? 7 : 3} className="h-24 text-center">No results found.</TableCell></TableRow> )}
                        </AnimatePresence>
                    </TableBody>
                </Table>
            </div>

            {pagination.totalPages > 1 && ( <div className="flex justify-end mt-4"> <DataPagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} /> </div> )}
        </div>
    );
}