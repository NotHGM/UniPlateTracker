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

## 🚀 Deployment

### Compatibility
ℹ️ This project was developed and thoroughly tested on the following production environment. While it is expected to work with other configurations, this is the official baseline:
*   **Operating System:** Debian 12
*   **UniFi Protect Camera:** UVC-AI-Pro (Device Version: 5.1.57)
*   **UniFi Protect Application:** Version 9.4.19

There are two primary methods for deploying UniPlateTracker. Choose the one that best fits your environment.

1.  **Manual Installation (with PM2):** Build the source code on your host machine. This gives you direct control over the files and process.
2.  **Docker:** Run the pre-built application in an isolated container. This is often simpler as it packages all dependencies (like FFmpeg) for you.

---

### Method 1: Manual Installation (from Source)

Follow these instructions to build and run UniPlateTracker directly on a host machine.

**Prerequisites:**
*   A server or computer to run the application (e.g., Linux VM, Raspberry Pi 5).
*   [Node.js](https://nodejs.org/) (v20.x or later).
*   [PostgreSQL](https://www.postgresql.org/) database.
*   [**FFmpeg**](https://ffmpeg.org/download.html) installed on the server. For Debian/Ubuntu: `sudo apt update && sudo apt install ffmpeg`.
*   A UniFi Protect NVR (UDM Pro, UNVR, etc.) with at least one LPR-capable camera.

**Step 1: Clone the Repository**
```bash
git clone https://github.com/NotHGM/UniPlateTracker.git
cd UniPlateTracker
```

**Step 2: Configure Environment Variables**
Create your configuration file by copying the example.
```bash
cp .env.example .env.local
```
Open `.env.local` with a text editor and fill in your details, including your `POSTGRES_URL` and `SESSION_SECRET`.

**Step 3: Create Video Directories (If Enabled)**
If you set `ENABLE_VIDEO_CAPTURE="true"`, you must create the directories specified in your `.env.local` file.
```bash
sudo mkdir -p /opt/captures/buffer
sudo chown your_user:your_group /opt/captures -R
```
*(Replace paths and `your_user:your_group` to match your setup).*

**Step 4: Install Dependencies**
```bash
npm install
npm install --prefix worker
```

**Step 5: Set Up the Database**
Run this interactive script to create all necessary tables and add the first approved admin email.
```bash
npm run db:init
```

**Step 6: Build and Run the Application**
First, build the optimized production code:
```bash
npm run build
```
Then, start the application:
```bash
npm start
```
Your application is now running, but it will stop if you close the terminal. For a persistent setup, proceed to the next step.

**Step 7: Run Persistently with PM2**
PM2 is a process manager that will keep your app running in the background and restart it automatically.

1.  **Install PM2 globally:**
    ```bash
    npm install pm2 -g
    ```

2.  **Start the application using PM2:**
    ```bash
    pm2 start "npm start" --name "uniplatetracker"
    ```

3.  **Save the process list and create a startup script:**
    ```bash
    pm2 startup
    pm2 save
    ```
You can monitor your app with `pm2 list` and view logs with `pm2 logs uniplatetracker`.

**Step 8: Configure the UniFi Protect Webhook**
Finally, tell your UniFi NVR where to send detection events by creating a Custom Webhook alarm that points to `http://[YOUR_SERVER_IP]:[WORKER_PORT]/webhook`.

---

### Method 2: Docker

This method uses the official pre-built Docker image. It's often faster as you don't need to install Node.js or FFmpeg on your host machine.

**Prerequisites:**
*   A server with Docker and Docker Compose installed.
*   An existing PostgreSQL database and its connection URL.

**Step 1: Create a Directory**
Create a folder on your server to hold your configuration files.
```bash
mkdir ~/uniplatetracker && cd ~/uniplatetracker
```

**Step 2: Download Configuration Files**
```bash
wget -O docker-compose.yml https://raw.githubusercontent.com/NotHGM/UniPlateTracker/main/docker-compose.yml
wget -O .env.example https://raw.githubusercontent.com/NotHGM/UniPlateTracker/main/.env.example
```

**Step 3: Configure Your Instance**
Rename the example file and edit it with your settings.
```bash
mv .env.example .env.local
nano .env.local
```
Fill in all your details, especially your `POSTGRES_URL`, `SESSION_SECRET`, and `NEXTAUTH_URL`.

**Step 4: Initialize the Database**
This one-time command connects to your database and sets up the required tables and your first admin user.
```bash
docker run --rm -it --env-file .env.local ghcr.io/nothgm/uniplatetracker:latest npm run db:init
```

**Step 5: Launch UniPlateTracker**
This command will pull the image and start the application in the background.
```bash
docker compose up -d
```

**Step 6: Configure the UniFi Protect Webhook**
Follow the same webhook setup instructions from Step 8 in the manual guide above to point UniFi Protect to `http://[YOUR_SERVER_IP]:[WORKER_PORT]/webhook`.

Your UniPlateTracker instance is now running!
*   **Web Interface:** `http://<your_server_ip>:3000`
*   **Webhook Endpoint:** `http://<your_server_ip>:4000`