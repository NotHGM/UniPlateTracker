# UniPlateTracker

**UniPlateTracker** is a secure, private, and self-hosted dashboard for tracking license plates captured by your UniFi Protect camera system. It gives you a clean web interface to view, search, and analyze vehicle activity on your property.

Events are received in real-time from your UniFi NVR via webhooks. The application can enrich license plates with official data (for UK users via the DVLA) and can automatically capture a short, time-accurate video clip of each detection. All data, including thumbnails and video files, is stored on your private server and managed by your own PostgreSQL database.

## ✨ Key Features

-   **Real-Time Event Processing:** Instantly receives and processes license plate detections via UniFi Protect webhooks.
-   **On-Demand Video Capture:** Automatically records a short video clip (with pre- and post-event buffering) for each detection using the camera's RTSP stream.
-   **Optional DVLA Integration:** For UK users, automatically fetches vehicle details like make, color, tax, and MOT status.
-   **International Mode:** Can be configured to work in any region by disabling UK-specific features.
-   **Secure Admin Dashboard:** A protected admin area with charts, usage statistics, and user management.
-   **Hierarchical Admin Accounts:** The initial admin can securely add or revoke access for other administrators.
-   **Full Audit Trail:** All administrative actions (adding/revoking users) are logged for the initial admin to review.
-   **Modern Web Interface:** A fast and responsive dashboard with dynamic filters, search, and automatic live updates.
-   **Light & Dark Mode:** Adapts to your system preferences for comfortable viewing.

## 🛠️ Tech Stack

-   **Framework:** Next.js (App Router)
-   **Language:** TypeScript
-   **Video Processing:** FFmpeg
-   **Backend:** Next.js API Routes & a standalone Node.js Worker/Buffer Manager
-   **Database:** PostgreSQL
-   **UI:** React, Tailwind CSS, shadcn/ui
-   **API Integration:** UniFi Protect Webhooks, DVLA API

---

## 🚀 Deployment Guide

Follow these instructions to build and run UniPlateTracker in a production environment.

### Prerequisites

-   A server or computer to run the application (e.g., Docker, Linux VM, Raspberry Pi 5).
-   [Node.js](https://nodejs.org/) (v20.x or later).
-   [PostgreSQL](https://www.postgresql.org/) database.
-   [**FFmpeg**](https://ffmpeg.org/download.html) installed on the server. For Debian/Ubuntu: `sudo apt update && sudo apt install ffmpeg`.
-   A UniFi Protect NVR (UDM Pro, UNVR, etc.) with at least one LPR-capable camera.
-   **(Optional for UK users)** An API Key from the [DVLA Vehicle Enquiry Service](https://developer.vehicle-operator-licensing.service.gov.uk/).

### Step 1: Clone the Repository
```bash
git clone https://github.com/NotHGM/UniPlateTracker.git
cd UniPlateTracker
```

### Step 2: Configure Environment Variables

Create your configuration file by copying the example.
```bash
cp .env.example .env.local
```

Open `.env.local` with a text editor and fill in your details. **This is a production setup, so use your server's actual IP address or domain name for `NEXTAUTH_URL`.**

### Step 3: Create Video Directories

If you enable video capture (`ENABLE_VIDEO_CAPTURE="true"`), you must create the directories for the final clips and the temporary buffer. Ensure the application has permission to write to them. For example, if your paths are `/opt/captures` and `/opt/captures/buffer`:
```bash
sudo mkdir -p /opt/captures/buffer
sudo chown your_user:your_group /opt/captures -R
```
*(Replace `your_user:your_group` with the user that will run the application).*

### Step 4: Install Dependencies

Install the necessary packages for both the main app and the worker service.
```bash
# Install root dependencies
npm install

# Install worker dependencies
npm install --prefix worker
```

### Step 5: Set Up the Database

Run this interactive script to create all necessary tables and add the first approved admin email.
```bash
npm run db:init
```
### Step 6: Configure the UniFi Protect Webhook

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

### Step 7: Build the Application for Production

This single command compiles both the Next.js frontend and the TypeScript worker into optimized JavaScript.
```bash
npm run build
```

### Step 8: Run the Application

This command starts both the Next.js web server and the background worker together.
```bash
npm start
```
Your application is now running. Keep the terminal open.

#### (Recommended) Running Persistently with PM2

To keep the application running after you close your terminal, use a process manager like PM2.

1.  **Install PM2 globally:**
    ```bash
    npm install pm2 -g
    ```

2.  **Start your entire application with PM2:**
    ```bash
    pm2 start "npm start" --name "uniplatetracker"
    ```

3.  **To ensure it restarts on server reboot, run:**
    ```bash
    pm2 startup
    pm2 save
    ```
You can monitor your app with `pm2 list` and view logs with `pm2 logs uniplatetrack`