// src/lib/types.ts

export interface LicensePlate {
    id: number;
    plate_number: string;
    capture_time: string;
    recent_capture_time: string;
    image_url: string | null;
    // --- ADD/UPDATE THESE FIELDS ---
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
    pagination: {
        currentPage: number;
        totalPages: number;
        totalRecords: number;
    };
}