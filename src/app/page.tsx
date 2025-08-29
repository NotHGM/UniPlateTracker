// src/app/page.tsx
import { PlatesApiResponse } from "@/lib/types";
import { PlatesTable } from "@/components/app/plates-table";
import { ModeToggle } from "@/components/mode-toggle";
import pool from "@/lib/db";

interface HomePageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

async function getPlatesData(searchParams: HomePageProps['searchParams']) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') {
      params.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach(v => params.append(key, v));
    }
  }
  const query = params.toString();

  const baseUrl = process.env.NEXTAUTH_URL;

  if (!baseUrl) {
    return { error: "Configuration error: NEXTAUTH_URL is not set." };
  }

  try {
    const platesResponse = await fetch(`${baseUrl}/api/plates?${query}`, { cache: 'no-store' });
    if (!platesResponse.ok) throw new Error(`API responded with ${platesResponse.status}`);

    const client = await pool.connect();
    let lastUpdate;
    try {
      const stateResult = await client.query('SELECT last_plate_update FROM app_state WHERE id = 1');
      lastUpdate = stateResult.rows[0]?.last_plate_update || new Date(0).toISOString();
    } finally {
      client.release();
    }

    const platesData: PlatesApiResponse = await platesResponse.json();
    platesData.lastCheckedTimestamp = lastUpdate;

    return { data: platesData };

  } catch (error) {
    console.error("Failed to fetch plates:", error);
    return { error: "Could not connect to the API service." };
  }
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { data, error } = await getPlatesData(searchParams);

  return (
      <div className="bg-background min-h-screen">
        <main className="container mx-auto p-4 sm:p-6 lg:p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">UniPlateTracker</h1>
              <p className="text-muted-foreground">
                A centralized dashboard for license plate monitoring.
              </p>
            </div>
            <ModeToggle />
          </div>
          <PlatesTable
              initialApiData={data}
              error={error}
          />
        </main>
      </div>
  );
}