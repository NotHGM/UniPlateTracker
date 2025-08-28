// src/app/page.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PlatesApiResponse } from "@/lib/types";
import { PlatesTable } from "@/components/app/plates-table";
import { ModeToggle } from "@/components/mode-toggle";

interface HomePageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const query = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === 'string') {
      query.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach(v => query.append(key, v));
    }
  });

  const baseUrl = process.env.NEXTAUTH_URL;
  let apiData: PlatesApiResponse | null = null;
  let fetchError: string | null = null;

  if (!baseUrl) {
    fetchError = "Configuration error: NEXTAUTH_URL is not set.";
  } else {
    try {
      const response = await fetch(`${baseUrl}/api/plates?${query.toString()}`, {
        cache: 'no-store',
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
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold">UniPlateTracker</h1>
            <p className="text-muted-foreground">
              A centralized dashboard for license plate monitoring.
            </p>
          </div>
          <ModeToggle />
        </div>

        {fetchError ? (
            <Card>
              <CardContent className="pt-6">
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{fetchError}</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
        ) : (
            <PlatesTable apiData={apiData} />
        )}
      </main>
  );
}