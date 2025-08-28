// src/app/page.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PlatesApiResponse } from "@/lib/types";
import { PlatesTable } from "@/components/app/plates-table";

// Update props to include all possible filters from your API
interface HomePageProps {
  searchParams: {
    page?: string;
    make?: string;
    color?: string;
    year?: string;
    fuelType?: string;
    tax?: string;
    mot?: string;
  };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  // Convert searchParams object to a query string, filtering out undefined values
  const query = new URLSearchParams(
      Object.entries(searchParams).reduce((acc, [key, value]) => {
        if (value) acc[key] = value;
        return acc;
      }, {} as Record<string, string>)
  ).toString();

  const baseUrl = process.env.NEXTAUTH_URL;

  let apiData: PlatesApiResponse | null = null;
  let fetchError: string | null = null;

  if (!baseUrl) {
    fetchError = "Configuration error: NEXTAUTH_URL is not set.";
  } else {
    try {
      const response = await fetch(`${baseUrl}/api/plates?${query}`, {
        cache: 'no-store', // Important for dynamic data
      });
      if (!response.ok) throw new Error(`API responded with ${response.status}`);
      apiData = await response.json();
    } catch (error) {
      console.error("Failed to fetch plates:", error);
      fetchError = "Could not connect to the API service.";
    }
  }

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
                <PlatesTable apiData={apiData} />
            )}
          </CardContent>
        </Card>
      </main>
  );
}