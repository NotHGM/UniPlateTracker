# UniPlateTracker

**UniPlateTracker** is a secure, private, and self-hosted dashboard for tracking license plates captured by your UniFi Protect camera system. It gives you a clean web interface to view, search, and analyze vehicle activity on your property.

Events are received in real-time from your UniFi NVR via webhooks. The application enriches each license plate with official data from the DVLA (such as make, color, tax, and MOT status) and stores everything, including thumbnail images, in your private PostgreSQL database.

## ✨ Key Features

-   **Real-Time Event Processing:** Instantly receives and processes license plate detections from UniFi Protect.
-   **DVLA Integration:** Automatically fetches vehicle details like make, color, tax, and MOT status.
-   **Private Image Storage:** Thumbnails are stored directly in your database, ensuring your data remains private and secure.
-   **Modern Web Dashboard:** A fast and responsive interface with dynamic filters, search, and automatic live updates for new detections.
-   **Admin Analytics:** A separate, protected admin dashboard with charts and statistics to visualize trends.
-   **Secure Authentication:** A complete admin login and sign-up system, with access controlled by a list of approved emails.
-   **Light & Dark Mode:** Adapts to your system preferences for comfortable viewing.

## 🛠️ Tech Stack

-   **Framework:** Next.js (App Router)
-   **Language:** TypeScript
-   **Backend:** Next.js API Routes & a standalone Express.js Worker
-   **Database:** PostgreSQL
-   **UI:** React, Tailwind CSS, shadcn/ui
-   **API Integration:** UniFi Protect Webhooks, DVLA API

---

## 🚀 Deployment Guide

Follow these instructions to build and run UniPlateTracker in a production environment.

### Prerequisites

-   A server or computer to run the application (e.g., Docker, Linux VM, Raspberry Pi 5).
-   [Node.js](https://nodejs.org/) (v20.x or later).
-   A [PostgreSQL](https://www.postgresql.org/) database.
-   A UniFi Protect NVR (UDM Pro, UNVR, etc.) with at least one LPR-capable camera.
-   An API Key from the [DVLA Vehicle Enquiry Service](https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/authentication-api/authentication-api-description.html).

### Step 1: Clone the Repository

```bash
git clone https://github.com/NotHGM/UniPlateTracker.git
cd UniPlateTracker
```

### Step 2: Configure Environment Variables

Create your production configuration file by copying the example. **Remember to use your server's real IP or domain for `NEXTAUTH_URL`.**
```bash
cp .env.example .env.local
```
Open `.env.local` and fill in your details (database URL, DVLA key, session secret, etc.).

### Step 3: Install Dependencies

Install the necessary packages for both the main app and the worker service.
```bash
# Install root dependencies
npm install

# Install worker dependencies
npm install --prefix worker
```

### Step 4: Set Up the Database

Run this interactive script to create all necessary tables and add the first approved admin email.
```bash
npm run db:init
```

### Step 5: Configure the UniFi Protect Webhook

Tell your UniFi NVR where to send detection events.
1.  In UniFi Protect, go to **Settings > System > Other Settings**.
2.  Under **Alarm Manager**, click **Create Alarm**.
3.  Configure the alarm:
    *   **Name:** `UniPlateTracker`
    *   **Trigger:** Go to **ID > LPR** and check **Unknown Vehicles** and **Known Vehicles**.
    *   **Scope:** Select your LPR camera(s).
    *   **Action:**
        *   **Webhook Type:** `Custom Webhook`
        *   **Delivery URL:** `http://[YOUR_SERVER_IP]:[WORKER_PORT]/webhook` (e.g., `http://192.168.1.50:4000/webhook`)
        *   **Advanced Settings > Method:** `POST`
        *   **Advanced Settings > Enable Use Thumbnails:** Toggle **ON**.
4.  Click **Save**.

### Step 6: Build the Application for Production

This single command compiles both the Next.js frontend and the TypeScript worker into optimized JavaScript.
```bash
npm run build
```

### Step 7: Run the Application

This single command starts both the Next.js web server and the background webhook worker together. The Next.js app will run on the port specified by the `PORT` environment variable (defaults to 3000), or you can specify it like so: `PORT=3007 npm start`.

```bash
npm start
```

Your application is now running. Keep the terminal open.

#### (Recommended) Running Persistently with PM2

To keep the application running after you close your terminal, you can use a process manager like PM2.

1.  **Install PM2 globally:**
    ```bash
    npm install pm2 -g
    ```

2.  **Start your entire application under one roof with PM2:**
    ```bash
    pm2 start "npm start" --name "uniplatetracker"
    ```

3.  **To ensure it restarts on server reboot, run:**
    ```bash
    pm2 startup
    pm2 save
    ```
You can monitor your app with `pm2 list`.