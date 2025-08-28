import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DataPagination } from "@/components/app/data-pagination";
import { LicensePlate, PlatesApiResponse } from "@/lib/types";

interface HomePageProps {
  searchParams?: {
    page?: string;
  };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const currentPage = Number(searchParams?.page) || 1;
  const baseUrl = process.env.NEXTAUTH_URL;

  let apiData: PlatesApiResponse | null = null;
  let fetchError: string | null = null;

  if (!baseUrl) {
    fetchError = "Configuration error: NEXTAUTH_URL is not set.";
  } else {
    try {
      const response = await fetch(`${baseUrl}/api/plates?page=${currentPage}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`API responded with ${response.status}`);
      apiData = await response.json();
    } catch (error) {
      console.error("Failed to fetch plates:", error);
      fetchError = "Could not connect to the API service.";
    }
  }

  const plates = apiData?.data ?? [];
  const pagination = apiData?.pagination ?? { currentPage: 1, totalPages: 0 };

  return (
      <main className="container mx-auto p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>UniPlateTracker</CardTitle>
            <CardDescription>
              A centralized dashboard for license plate monitoring.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fetchError ? (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{fetchError}</AlertDescription>
                </Alert>
            ) : (
                <>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {/* Add a new column for the image */}
                          <TableHead className="w-[150px]">Image</TableHead>
                          <TableHead>Number Plate</TableHead>
                          <TableHead>Make & Color</TableHead>
                          <TableHead className="text-right">Last Seen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plates.length > 0 ? (
                            plates.map((plate: LicensePlate) => (
                                <TableRow key={plate.id}>
                                  {/* Render the image directly from the base64 string */}
                                  <TableCell>
                                    {plate.image_url ? (
                                        <img
                                            src={plate.image_url}
                                            alt={`Capture of ${plate.plate_number}`}
                                            className="w-full h-auto rounded-md object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-16 bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">
                                          No Image
                                        </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="font-medium">{plate.plate_number}</TableCell>
                                  <TableCell>{plate.car_make || 'N/A'} - {plate.car_color || 'N/A'}</TableCell>
                                  <TableCell className="text-right">
                                    {new Date(plate.recent_capture_time).toLocaleString()}
                                  </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="h-24 text-center">
                                No data available. Waiting for the first plate detection.
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
            )}
          </CardContent>
        </Card>
      </main>
  );
}