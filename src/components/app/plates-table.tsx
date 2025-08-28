// src/components/app/plates-table.tsx
"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LicensePlate, PlatesApiResponse } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DataPagination } from "./data-pagination";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import styles from "./plates.module.css";

dayjs.extend(relativeTime);

interface PlatesTableProps {
    initialApiData: PlatesApiResponse | null;
}

const formatPlate = (plate: string | null): JSX.Element => {
    if (!plate) return <>{'N/A'}</>;
    plate = plate.replace(/\s/g, '');
    if (plate.length >= 7) {
        const firstPart = plate.substring(0, 4);
        const secondPart = plate.substring(4);
        return <><span>{firstPart}</span><span>{secondPart}</span></>;
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

export function PlatesTable({ initialApiData }: PlatesTableProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [filters, setFilters] = useState({
        make: searchParams.get('make') || 'all',
        color: searchParams.get('color') || 'all',
        year: searchParams.get('year') || 'all',
        mot: searchParams.get('mot') || 'all',
        tax: searchParams.get('tax') || 'all',
    });

    const plates = initialApiData?.data ?? [];
    const pagination = initialApiData?.pagination ?? { currentPage: 1, totalPages: 0 };
    const filterOptions = initialApiData?.filterOptions ?? { makes: [], colors: [], years: [] };

    useEffect(() => {
        const timer = setTimeout(() => {
            const current = new URLSearchParams(searchParams.toString());
            if (searchTerm) {
                current.set("search", searchTerm);
            } else {
                current.delete("search");
            }
            current.set("page", "1");
            router.push(`${pathname}?${current.toString()}`, { scroll: false });
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm, searchParams, pathname, router]);

    const handleApplyFilters = () => {
        const current = new URLSearchParams(searchParams.toString());
        Object.entries(filters).forEach(([key, value]) => {
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
        setSearchTerm('');
        setFilters({ make: 'all', color: 'all', year: 'all', mot: 'all', tax: 'all' });
        router.push(pathname, { scroll: false });
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Input placeholder="Search for a license plate..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="text-base" />
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={filters.make} onValueChange={(v) => setFilters(f => ({...f, make: v}))}>
                        <SelectTrigger className="flex-1 min-w-[120px]"><SelectValue placeholder="All Makes" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Makes</SelectItem>{filterOptions.makes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filters.color} onValueChange={(v) => setFilters(f => ({...f, color: v}))}>
                        <SelectTrigger className="flex-1 min-w-[120px]"><SelectValue placeholder="All Colors" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Colors</SelectItem>{filterOptions.colors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filters.year} onValueChange={(v) => setFilters(f => ({...f, year: v}))}>
                        <SelectTrigger className="w-full md:w-auto min-w-[120px]"><SelectValue placeholder="All Years" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Years</SelectItem>{filterOptions.years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filters.mot} onValueChange={(v) => setFilters(f => ({...f, mot: v}))}>
                        <SelectTrigger className="w-full md:w-auto min-w-[140px]"><SelectValue placeholder="All MOT" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All MOT</SelectItem><SelectItem value="Valid">Valid</SelectItem><SelectItem value="Expired">Expired</SelectItem></SelectContent>
                    </Select>
                    <Select value={filters.tax} onValueChange={(v) => setFilters(f => ({...f, tax: v}))}>
                        <SelectTrigger className="w-full md:w-auto min-w-[140px]"><SelectValue placeholder="All Tax" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Tax</SelectItem><SelectItem value="Taxed">Taxed</SelectItem><SelectItem value="Not Taxed">Not Taxed</SelectItem></SelectContent>
                    </Select>
                    <div className="flex gap-2 ml-auto">
                        <Button onClick={handleApplyFilters}>Apply Filters</Button>
                        <Button onClick={handleClearFilters} variant="ghost">Clear</Button>
                    </div>
                </div>
            </div>

            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">Image</TableHead>
                            <TableHead>Plate</TableHead>
                            <TableHead>Vehicle Details</TableHead>
                            <TableHead>MOT</TableHead>
                            <TableHead>Tax</TableHead>
                            <TableHead>Registration</TableHead>
                            <TableHead className="text-left">Last Seen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {plates.length > 0 ? (
                            plates.map((plate) => (
                                <TableRow key={plate.id}>
                                    <TableCell>
                                        {plate.image_url ? (<img src={plate.image_url} alt={`Capture of ${plate.plate_number}`} className="w-28 h-auto rounded-md object-cover"/>) : (<div className="w-28 h-16 bg-muted rounded-md"/>)}
                                    </TableCell>
                                    <TableCell className="align-middle">
                                        <div className={styles.plateStyle}>{formatPlate(plate.plate_number)}</div>
                                    </TableCell>
                                    <TableCell className="align-top pt-3">
                                        <div className="font-semibold">{plate.car_make || 'N/A'}</div>
                                        <div className="text-sm text-muted-foreground">{plate.car_color || 'N/A'} • {plate.fuel_type || 'N/A'}</div>
                                    </TableCell>
                                    <TableCell className="align-top pt-3">
                                        <div className={cn(styles.badge, getStatusClass(plate.mot_status))}>{plate.mot_status || 'N/A'}</div>
                                        {plate.mot_expiry_date && <div className="text-xs text-muted-foreground mt-1">Expires {dayjs(plate.mot_expiry_date).format('DD/MM/YYYY')}</div>}
                                    </TableCell>
                                    <TableCell className="align-top pt-3">
                                        <div className={cn(styles.badge, getStatusClass(plate.tax_status))}>{plate.tax_status || 'N/A'}</div>
                                        {plate.tax_due_date && <div className="text-xs text-muted-foreground mt-1">Due {dayjs(plate.tax_due_date).format('DD/MM/YYYY')}</div>}
                                    </TableCell>
                                    <TableCell className="align-top pt-3">
                                        <div className="font-semibold">{plate.year_of_manufacture || 'N/A'}</div>
                                        <div className="text-sm text-muted-foreground">{plate.month_of_first_registration ? `Reg: ${dayjs(plate.month_of_first_registration).format('MMM YYYY')}` : 'N/A'}</div>
                                    </TableCell>
                                    <TableCell className="text-left align-top pt-3">
                                        <div className="font-semibold">{dayjs(plate.recent_capture_time).fromNow()}</div>
                                        <div className="text-xs text-muted-foreground">{dayjs(plate.recent_capture_time).format('DD/MM/YY HH:mm')}</div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={7} className="h-24 text-center">No results found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            {pagination.totalPages > 1 && (
                <div className="flex justify-center mt-4">
                    <DataPagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} />
                </div>
            )}
        </div>
    );
}