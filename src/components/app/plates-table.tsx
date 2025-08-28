// src/components/app/plates-table.tsx
"use client";

import { useState } from "react";
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
    apiData: PlatesApiResponse | null;
}

// Function to format the plate with a space
const formatPlate = (plate: string | null): JSX.Element => {
    if (!plate) return <>{'N/A'}</>;
    // Standard UK format is 7 chars. Split after the 4th.
    if (plate.length === 7) {
        return (
            <>
                <span>{plate.substring(0, 4)}</span>
                <span>{plate.substring(4)}</span>
            </>
        );
    }
    return <span>{plate}</span>;
};

const getStatusClass = (status: string | null): string => {
    if (!status) return styles.badgeSecondary;
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'valid' || lowerStatus === 'taxed') {
        return styles.badgeSuccess;
    }
    if (lowerStatus.includes('expire') || lowerStatus.includes('due') || lowerStatus.includes('not taxed')) {
        return styles.badgeDestructive;
    }
    return styles.badgeSecondary;
};

export function PlatesTable({ apiData }: PlatesApiResponse) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [filters, setFilters] = useState({
        make: searchParams.get('make') || '',
        color: searchParams.get('color') || '',
        year: searchParams.get('year') || '',
    });

    const plates = apiData?.data ?? [];
    const pagination = apiData?.pagination ?? { currentPage: 1, totalPages: 0 };

    const handleApplyFilters = () => {
        const current = new URLSearchParams(Array.from(searchParams.entries()));
        for (const [key, value] of Object.entries(filters)) {
            if (value) current.set(key, value);
            else current.delete(key);
        }
        current.set("page", "1");
        router.push(`${pathname}?${current.toString()}`);
    };

    const handleSelectFilterChange = (type: 'mot' | 'tax', value: string) => {
        const current = new URLSearchParams(Array.from(searchParams.entries()));
        if (value === 'all') current.delete(type);
        else current.set(type, value);
        current.set("page", "1");
        router.push(`${pathname}?${current.toString()}`);
    };

    const handleClearFilters = () => {
        router.push(pathname);
    }

    return (
        <>
            {/* --- CORRECTED Filter Section Layout --- */}
            <div className="flex flex-wrap items-center gap-2 md:gap-4 mb-4">
                <Input className="flex-auto min-w-[150px]" placeholder="Make (e.g., AUDI)" value={filters.make} onChange={e => setFilters({...filters, make: e.target.value.toUpperCase()})} />
                <Input className="flex-auto min-w-[150px]" placeholder="Color (e.g., BLACK)" value={filters.color} onChange={e => setFilters({...filters, color: e.target.value.toUpperCase()})} />
                <Input className="w-32" type="number" placeholder="Year (e.g., 2009)" value={filters.year} onChange={e => setFilters({...filters, year: e.target.value})} />
                <div className="w-48">
                    <Select onValueChange={(value) => handleSelectFilterChange('mot', value)} defaultValue={searchParams.get('mot') || 'all'}>
                        <SelectTrigger><SelectValue placeholder="All MOT Statuses" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All MOT Statuses</SelectItem>
                            <SelectItem value="Valid">Valid</SelectItem>
                            <SelectItem value="Expired">Expired</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="w-48">
                    <Select onValueChange={(value) => handleSelectFilterChange('tax', value)} defaultValue={searchParams.get('tax') || 'all'}>
                        <SelectTrigger><SelectValue placeholder="All Tax Statuses" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Tax Statuses</SelectItem>
                            <SelectItem value="Taxed">Taxed</SelectItem>
                            <SelectItem value="Not Taxed">Not Taxed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex gap-2 ml-auto">
                    <Button onClick={handleApplyFilters}>Apply Filters</Button>
                    <Button onClick={handleClearFilters} variant="outline">Clear</Button>
                </div>
            </div>

            <div className="border rounded-lg overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[150px]">Image</TableHead>
                            <TableHead>Plate</TableHead>
                            <TableHead>Vehicle Details</TableHead>
                            <TableHead>MOT</TableHead>
                            <TableHead>Tax</TableHead>
                            <TableHead>Registration</TableHead>
                            <TableHead>Last Seen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {plates.length > 0 ? (
                            plates.map((plate) => (
                                <TableRow key={plate.id}>
                                    <TableCell>
                                        {plate.image_url ? (
                                            <img src={plate.image_url} alt={`Capture of ${plate.plate_number}`} className="min-w-[140px] h-auto rounded-md object-cover"/>
                                        ) : (
                                            <div className="w-full h-20 bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">No Image</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="align-middle">
                                        <div className={styles.plateStyle}>
                                            {formatPlate(plate.plate_number)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top pt-4">
                                        <div className="font-medium">{plate.car_make || 'N/A'}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {plate.car_color || 'N/A'} • {plate.fuel_type || 'N/A'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top pt-4">
                                        <div className={cn(styles.badge, getStatusClass(plate.mot_status))}>
                                            {plate.mot_status || 'N/A'}
                                        </div>
                                        {plate.mot_expiry_date && <div className="text-xs text-muted-foreground mt-1">Expires {dayjs(plate.mot_expiry_date).format('DD/MM/YYYY')}</div>}
                                    </TableCell>
                                    <TableCell className="align-top pt-4">
                                        <div className={cn(styles.badge, getStatusClass(plate.tax_status))}>
                                            {plate.tax_status || 'N/A'}
                                        </div>
                                        {plate.tax_due_date && <div className="text-xs text-muted-foreground mt-1">Due {dayjs(plate.tax_due_date).format('DD/MM/YYYY')}</div>}
                                    </TableCell>
                                    <TableCell className="align-top pt-4">
                                        <div className="font-medium">{plate.year_of_manufacture || 'N/A'}</div>
                                        <div className="text-sm text-muted-foreground">{plate.month_of_first_registration ? `Reg: ${dayjs(plate.month_of_first_registration).format('MMM YYYY')}` : 'N/A'}</div>
                                    </TableCell>
                                    <TableCell className="text-right align-top pt-4">
                                        <div className="text-sm font-medium">{dayjs(plate.recent_capture_time).fromNow()}</div>
                                        <div className="text-xs text-muted-foreground">{dayjs(plate.recent_capture_time).format('DD/MM/YY HH:mm')}</div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    No data available.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="py-4">
                <DataPagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                />
            </div>
        </>
    );
}