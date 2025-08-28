# UniPlateTracker

**UniPlateTracker** is a robust, self-hosted license plate recognition and tracking dashboard. It is designed for prosumer and enterprise use, providing a secure and scalable solution for monitoring vehicle activity directly from a UniFi Protect camera system.

This application uses a real-time, event-driven architecture. A dedicated background worker listens for webhook notifications directly from a UniFi Protect NVR. When a license plate is detected, the worker processes the event, saves the included `base64` thumbnail image directly into a PostgreSQL database, and logs the event details. The data is then presented in a clean, modern web interface built with Next.js.

---

## ✨ Key Features

- **Real-Time Webhook Processing:** A dedicated background service instantly receives LPR (License Plate Recognition) events from UniFi Protect.
- **Self-Contained Image Storage:** Decodes `base64` thumbnails from the webhook payload and stores them directly in the database, requiring no server file system storage.
- **Modern Web Dashboard:** A fast and responsive web UI built with Next.js and shadcn/ui.
- **Server-Driven UI:** Utilizes React Server Components for optimal performance and data fetching.
- **Paginated Data Table:** Efficiently handles large datasets with server-side pagination.
- **Secure Backend:** Features a type-safe API with input validation using Zod.
- **Enterprise-Grade Architecture:** Employs a stable two-process model (web server + background worker) to ensure UI responsiveness and service reliability.

## 🛠️ Tech Stack

- **Framework:** Next.js (App Router, Turbopack)
- **Language:** TypeScript
- **Backend:** Next.js API Routes & a standalone Node.js Worker Service (using Express.js)
- **Database:** PostgreSQL
- **UI:** React, Tailwind CSS, shadcn/ui
- **Data Validation:** Zod
- **Core Integration:** UniFi Protect (via LPR Webhooks)

---

## 🚀 Getting Started

Follow these instructions to get a development environment up and running.

### Prerequisites

- [Node.js](https://nodejs.org/) (v20.x or later is highly recommended)
- [npm](https://www.npmjs.com/) or your preferred package manager
- [PostgreSQL](https://www.postgresql.org/) Database Server
- A running UniFi Protect NVR (UDM Pro, UNVR, etc.) with at least one camera capable of LPR.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/NotHGM/UniPlateTracker.git
    cd UniPlateTracker
    ```

2.  **Configure Environment Variables:**
    Create a local environment file by copying the example.
    ```bash
    cp .env.example .env.local
    ```
    Now, open `.env.local` and fill in all the required values.

3.  **Install Dependencies:**
    This project uses a monorepo-like structure with a separate `worker` directory.
    ```bash
    # Install root dependencies for the Next.js app
    npm install

    # Install worker dependencies
    cd worker
    npm install
    cd ..
    ```

4.  **Set Up the Database:**
    Run the database migration scripts in order to create and configure the `license_plates` table.
    ```bash
    npx ts-node --require dotenv/config scripts/001-create-initial-tables.ts
    npx ts-node --require dotenv/config scripts/004-change-image-column-to-text.ts
    ```

5.  **Configure UniFi Protect Webhook:**
    - In your UniFi Protect dashboard, go to the **System Log > Alarms**.
    - Create a **New Alarm**.
    - **Trigger:** Select the **ID** tab, then the **LPR** sub-tab. Check "Unknown Vehicles" and "Known Vehicles".
    - **Scope:** Select the camera(s) you want to monitor.
    - **Action:** Select **Webhook**.
        - **Delivery URL:** `http://[IP_OF_YOUR_SERVER]:[WORKER_PORT]/webhook` (e.g., `http://192.168.1.177:4000/webhook`)
        - Click **Advanced Settings** and ensure the **Method** is set to **POST**.

6.  **Run the Application:**
    Start the entire application (Next.js web server and background worker) with a single command.
    ```bash
    npm run dev
    ```
    Your application will be available at `http://localhost:3000` (or the `NEXTAUTH_URL` you configured).

---

## ⚙️ Environment Variables

The following variables must be set in your `.env.local` file for the application to function.

| Variable          | Description                                                               | Example                                     |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------------------- |
| `POSTGRES_URL`    | The full connection string for your PostgreSQL database.                  | `postgresql://user:pass@host:5432/dbname`   |
| `WORKER_PORT`     | The network port for the webhook worker service to listen on.             | `4000`                                      |
| `NEXTAUTH_URL`    | The canonical URL of your web application.                                | `http://localhost:3000`                     |
| `NEXTAUTH_SECRET` | A strong, random secret for signing authentication tokens (for future use). | `generate-with-openssl-rand-base64-32`      |


## 🗺️ Future Roadmap

- [ ] **DVLA Integration:** Fetch vehicle details (make, color, tax status) from the DVLA API.
- [ ] **User Authentication:** Implement user logins and role-based access control with NextAuth.js.
- [ ] **Advanced Filtering & Search:** Add UI controls to filter the data table by make, color, date, etc.
- [ ] **Dashboard Analytics:** Add charts and graphs to visualize detection trends over time.