// This file will hold all the TypeScript types for our application.

// Defines the structure of a single license plate record from our database/API.
export type LicensePlate = {
    id: number;
    plate_number: string;
    capture_time: string; // ISO date string
    recent_capture_time: string; // ISO date string
    video_url: string | null;
    car_make: string | null;
    car_color: string | null;
    fuel_type: string | null;
    mot_status: string | null;
    tax_status: string | null;
    mot_expiry_date: string | null; // ISO date string
    tax_due_date: string | null; // ISO date string
    year_of_manufacture: number | null;
    created_at: string; // ISO date string
    updated_at: string; // ISO date string
};

// Defines the shape of the entire API response from our /api/plates endpoint.
export type PlatesApiResponse = {
    data: LicensePlate[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalRows: number;
    };
};