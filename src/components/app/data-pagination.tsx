'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

// Define the properties (props) that this component will accept.
interface DataPaginationProps {
    currentPage: number;
    totalPages: number;
}

export function DataPagination({ currentPage, totalPages }: DataPaginationProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const createPageURL = (pageNumber: number | string) => {
        // Create a mutable copy of the current search parameters.
        const params = new URLSearchParams(searchParams);
        params.set('page', pageNumber.toString());
        // Return the full path with the updated page parameter.
        return `${pathname}?${params.toString()}`;
    };

    const handlePrevious = () => {
        if (currentPage > 1) {
            router.push(createPageURL(currentPage - 1));
        }
    };

    const handleNext = () => {
        if (currentPage < totalPages) {
            router.push(createPageURL(currentPage + 1));
        }
    };

    return (
        <div className="flex items-center justify-end space-x-2">
      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
            <div className="flex items-center space-x-2">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePrevious}
                    disabled={currentPage <= 1}
                >
                    <ChevronLeftIcon className="h-4 w-4" />
                    <span className="sr-only">Previous Page</span>
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNext}
                    disabled={currentPage >= totalPages}
                >
                    <ChevronRightIcon className="h-4 w-4" />
                    <span className="sr-only">Next Page</span>
                </Button>
            </div>
        </div>
    );
}