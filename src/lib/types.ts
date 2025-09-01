// src/lib/types.ts

export interface LicensePlate {
    id: number;
    plate_number: string;
    capture_time: string;
    recent_capture_time: string;
    image_url: string | null;
    video_url: string | null;
    car_make: string | null;
    car_color: string | null;
    fuel_type: string | null;
    mot_status: string | null;
    tax_status: string | null;
    mot_expiry_date: string | null;
    tax_due_date: string | null;
    year_of_manufacture: number | null;
    month_of_first_registration: string | null;
}

export interface PlatesApiResponse {
    data: LicensePlate[];
    lastCheckedTimestamp?: string;
    pagination: {
        currentPage: number;
        totalPages: number;
        totalRows: number;
    };
    filterOptions: {
        makes: string[];
        colors: string[];
        years: number[];
    };
    error?: string;
}