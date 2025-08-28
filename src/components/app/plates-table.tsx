// src/components/app/plates-table.tsx
"use client"; // <--- This is very important! It marks the component as client-side.

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LicensePlate, PlatesApiResponse } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataPagination } from "./data-pagination";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface PlatesTableProps {
    apiData: PlatesApiResponse | null;
}

// Helper for conditional badge styling (green for good, red for bad)
const getStatusVariant = (status: string | null): "default" | "secondary" | "destructive" => {
    if (!status) return "secondary";
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'valid' || lowerStatus === 'taxed') {
        return "default"; // Will be styled green
    }
    if (lowerStatus.includes('expire') || lowerStatus.includes('due') || lowerStatus.includes('not taxed')) {
        return "destructive";
    }
    return "secondary";
};

export function PlatesTable({ apiData }: PlatesTableProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Local state to hold filter values before applying them
    const [filters, setFilters] = useState({
        make: searchParams.get('make') || '',
        color: searchParams.get('color') || '',
        year: searchParams.get('year') || '',
    });

    const plates = apiData?.data ?? [];
    const pagination = apiData?.pagination ?? { currentPage: 1, totalPages: 0 };

    const handleApplyFilters = () => {
        const current = new URLSearchParams(Array.from(searchParams.entries()));

        // Set text input filters
        for (const [key, value] of Object.entries(filters)) {
            if (value) {
                current.set(key, value);
            } else {
                current.delete(key);
            }
        }

        current.set("page", "1"); // Reset to first page on filter change
        const search = current.toString();
        const query = search ? `?${search}` : "";
        router.push(`${pathname}${query}`);
    };

    const handleSelectFilterChange = (type: 'mot' | 'tax', value: string) => {
        const current = new URLSearchParams(Array.from(searchParams.entries()));
        if (value === 'all') {
            current.delete(type);
        } else {
            current.set(type, value);
        }
        current.set("page", "1");
        const search = current.toString();
        const query = search ? `?${search}` : "";
        router.push(`${pathname}${query}`);
    };

    const handleClearFilters = () => {
        router.push(pathname);
    }

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4 p-4 border rounded-lg">
                <Input placeholder="Make (e.g., AUDI)" value={filters.make} onChange={e => setFilters({...filters, make: e.target.value.toUpperCase()})} />
                <Input placeholder="Color (e.g., BLACK)" value={filters.color} onChange={e => setFilters({...filters, color: e.target.value.toUpperCase()})} />
                <Input type="number" placeholder="Year (e.g., 2009)" value={filters.year} onChange={e => setFilters({...filters, year: e.target.value})} />
                <Select onValueChange={(value) => handleSelectFilterChange('mot', value)} defaultValue={searchParams.get('mot') || 'all'}>
                    <SelectTrigger><SelectValue placeholder="MOT Status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All MOT Statuses</SelectItem>
                        <SelectItem value="Valid">Valid</SelectItem>
                        <SelectItem value="Expired">Expired</SelectItem>
                    </SelectContent>
                </Select>
                <Select onValueChange={(value) => handleSelectFilterChange('tax', value)} defaultValue={searchParams.get('tax') || 'all'}>
                    <SelectTrigger><SelectValue placeholder="Tax Status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Tax Statuses</SelectItem>
                        <SelectItem value="Taxed">Taxed</SelectItem>
                        <SelectItem value="Not Taxed">Not Taxed</SelectItem>
                    </SelectContent>
                </Select>
                <div className="flex gap-2 col-span-full md:col-span-1">
                    <Button onClick={handleApplyFilters} className="w-full">Apply Filters</Button>
                    <Button onClick={handleClearFilters} variant="outline" className="w-full">Clear</Button>
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[150px]">Image</TableHead>
                            <TableHead>Plate</TableHead>
                            <TableHead>Vehicle Details</TableHead>
                            <TableHead>MOT</TableHead>
                            <TableHead>Tax</TableHead>
                            <TableHead>Registration</TableHead>
                            <TableHead className="text-right">Last Seen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {plates.length > 0 ? (
                            plates.map((plate) => (
                                <TableRow key={plate.id}>
                                    <TableCell>
                                        {plate.image_url ? (
                                            <img src={plate.image_url} alt={`Capture of ${plate.plate_number}`} className="w-full h-auto rounded-md object-cover"/>
                                        ) : (
                                            <div className="w-full h-16 bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">No Image</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-mono text-lg">{plate.plate_number}</TableCell>
                                    <TableCell>
                                        <div className="font-medium">{plate.car_make || 'N/A'}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {plate.car_color || 'N/A'} • {plate.fuel_type || 'N/A'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusVariant(plate.mot_status)}>{plate.mot_status || 'N/A'}</Badge>
                                        {plate.mot_expiry_date && <div className="text-xs text-muted-foreground mt-1">Expires {dayjs(plate.mot_expiry_date).format('DD/MM/YYYY')}</div>}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusVariant(plate.tax_status)}>{plate.tax_status || 'N/A'}</Badge>
                                        {plate.tax_due_date && <div className="text-xs text-muted-foreground mt-1">Due {dayjs(plate.tax_due_date).format('DD/MM/YYYY')}</div>}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{plate.year_of_manufacture || 'N/A'}</div>
                                        <div className="text-sm text-muted-foreground">{plate.month_of_first_registration ? `Reg: ${dayjs(plate.month_of_first_registration).format('MMM YYYY')}` : 'N/A'}</div>
                                    </TableCell>
                                    <TableCell className="text-right text-xs">
                                        {dayjs(plate.recent_capture_time).fromNow()}
                                        <div className="text-muted-foreground">{dayjs(plate.recent_capture_time).format('DD/MM/YY HH:mm')}</div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    No data available. Waiting for plate detections or adjust filters.
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