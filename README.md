# UniPlateTracker

**UniPlateTracker** is a robust, self-hosted license plate recognition and tracking dashboard. It is designed for prosumer and enterprise use, providing a secure and scalable solution for monitoring vehicle activity from RTSP-enabled cameras via Home Assistant.

---

## 📋 Project Overview

This application bridges the gap between smart home platforms and professional-grade monitoring. It polls a Home Assistant sensor (updated by a camera integration like UniFi Protect) for license plate detections. When a plate is detected, a dedicated background worker captures a high-quality image from the camera's live stream and logs the event in a PostgreSQL database.

The data is then presented in a clean, modern web interface built with Next.js, featuring server-side rendering for performance and a fully interactive data table.

## ✨ Key Features

- **Real-time Polling:** A dedicated background service continuously polls Home Assistant for new license plate data.
- **On-Demand Image Capture:** Captures a high-resolution snapshot from any RTSP stream at the moment of detection.
- **Modern Web Dashboard:** A fast and responsive web UI built with Next.js and shadcn/ui.
- **Server-Driven UI:** Utilizes React Server Components for optimal performance and data fetching.
- **Paginated Data Table:** Efficiently handles large datasets with server-side pagination.
- **Secure Backend:** Features a type-safe API with input validation using Zod.
- **Enterprise-Grade Architecture:** Employs a stable two-process model (web server + background worker) to ensure UI responsiveness and service reliability.

## 🛠️ Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Backend:** Next.js API Routes & a standalone Node.js Worker Service
- **Database:** PostgreSQL
- **UI:** React, Tailwind CSS, shadcn/ui
- **Data Validation:** Zod
- **Core Integrations:**
    - Home Assistant (for sensor data)
    - FFmpeg (for RTSP image capture)

---

## 🚀 Getting Started

Follow these instructions to get a development environment up and running.

### Prerequisites

You must have the following installed and configured on your system:

- [Node.js](https://nodejs.org/) (v18 or later)
- [npm](https://www.npmjs.com/) (or your preferred package manager)
- [PostgreSQL](https://www.postgresql.org/) Database Server
- [FFmpeg](https://ffmpeg.org/download.html) (must be accessible in your system's PATH)
- A running [Home Assistant](https://www.home-assistant.io/) instance with a configured camera integration that provides a license plate sensor.

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
    Now, open `.env.local` and **fill in all the required values** (database URL, Home Assistant details, etc.). See the table below for a description of each variable.

3.  **Install Dependencies:**
    Install dependencies for both the main Next.js app and the background worker.
    ```bash
    # Install root dependencies
    npm install

    # Install worker dependencies
    cd worker
    npm install
    cd ..
    ```

4.  **Set Up the Database:**
    Run the database migration scripts to create the necessary tables and columns.
    ```bash
    npx ts-node --require dotenv/config scripts/001-create-initial-tables.ts
    npx ts-node --require dotenv/config scripts/002-add-image-url-column.ts
    ```

5.  **Run the Application:**
    Start the entire application (Next.js web server and background worker) with a single command.
    ```bash
    npm run dev
    ```
    Your application will be available at `http://localhost:3000` (or the `NEXTAUTH_URL` you configured).

---

## ⚙️ Environment Variables

The following variables must be set in your `.env.local` file for the application to function.

| Variable                      | Description                                                                                              | Example                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `POSTGRES_URL`                | The full connection string for your PostgreSQL database.                                                 | `postgresql://user:pass@host:5432/dbname`                      |
| `NEXTAUTH_SECRET`             | A strong, random secret for signing authentication tokens (future use).                                  | `your-super-strong-random-secret`                              |
| `NEXTAUTH_URL`                | The canonical URL of your web application.                                                               | `http://localhost:3000`                                        |
| `HOME_ASSISTANT_URL`          | The URL for your Home Assistant instance.                                                                | `http://192.168.1.100:8123`                                    |
| `LONG_LIVED_ACCESS_TOKEN`     | The Long-Lived Access Token generated from your Home Assistant profile.                                  | `ey...`                                                        |
| `HOME_ASSISTANT_SENSOR_NAME`  | The Entity ID of the Home Assistant sensor that holds the last seen license plate.                       | `input_text.last_license_plate`                                |
| `RTSP_URL`                    | The full RTSP URL for your camera's live stream.                                                         | `rtsp://user:pass@192.168.1.20/stream1`                          |
| `ENABLE_VIDEO_CAPTURE`        | Set to `true` to enable video capture (future feature).                                                  | `true`                                                         |
| `BACKGROUND_TASK_POLL_RATE`   | The interval in milliseconds for the worker to poll Home Assistant.                                      | `10000` (for 10 seconds)                                       |


## 🗺️ Future Roadmap

- [ ] **DVLA Integration:** Fetch vehicle details (make, color, tax status) from the DVLA API.
- [ ] **User Authentication:** Implement user logins and role-based access control with NextAuth.js.
- [ ] **Advanced Filtering & Search:** Add UI controls to filter the data table by make, color, date, etc.
- [ ] **Video Snippet Capture:** Implement the functionality to save short video clips on detection.
- [ ] **Dashboard Analytics:** Add charts and graphs to visualize detection trends over time.