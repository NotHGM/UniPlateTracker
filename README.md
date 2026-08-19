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
-   **Built for Scanning:** A dense, sortable detections table designed for reading quickly rather than for looking impressive. Sorting and filtering run in the database, so ordering applies to the whole result set and not just the page you happen to be on.
-   **Status That Marks the Exception:** Most vehicles are taxed with a valid MOT, so those stay visually quiet. Only expired, untaxed and SORN vehicles are highlighted, and "no DVLA record" is shown distinctly so missing information never reads as a clean result.
-   **Works on a Phone:** The table reflows into a card list on narrow screens, so every column stays reachable rather than being cut off.
-   **Accessible:** Labelled controls throughout, keyboard-operable sorting and paging, `aria-sort` on the table, and `prefers-reduced-motion` respected. Audited with zero violations.
-   **Light & Dark Mode:** Adapts to your system preferences for comfortable viewing.

## 🛠️ Tech Stack

-   **Framework:** Next.js 16 (App Router)
-   **Language:** TypeScript
-   **Video Processing:** FFmpeg
-   **Backend:** Next.js API Routes & a standalone Node.js Worker/Buffer Manager
-   **Database:** PostgreSQL
-   **UI:** React 19, Tailwind CSS v4, shadcn/ui
-   **API Integration:** UniFi Protect Webhooks, DVLA API

> **Note on styling:** Tailwind v4 takes its theme from CSS rather than from a
> JavaScript config, so there is no `tailwind.config.ts`. All design tokens —
> colours, radii, the plate and status styles — live in the `@theme` block in
> `src/app/globals.css`. That file is the single place to change the look.

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
---

### Method 2: Docker

This method uses the official pre-built Docker image. It's the recommended and fastest way to get started, as you don't need to install Node.js or FFmpeg on your host machine.

**Prerequisites:**
*   A server with Docker and Docker Compose installed.
*   An existing PostgreSQL database and its connection URL.

**Step 1: Create a Directory**
Create a folder on your server to hold your configuration files.

```bash
mkdir ~/uniplatetracker && cd ~/uniplatetracker
```


**Step 2: Download Configuration Files**
Download the `docker-compose.yml` and the environment variable template from the repository. Ensure your `docker-compose.yml` is set to use the `:main` image tag.

```bash
wget -O docker-compose.yml https://raw.githubusercontent.com/NotHGM/UniPlateTracker/main/docker-compose.yml
wget -O .env.example https://raw.githubusercontent.com/NotHGM/UniPlateTracker/main/.env.example
```


**Step 3: Configure Your Instance**
Rename the example file. The application will specifically load its configuration from `.env.local`.

```bash
mv .env.example .env.local
```

Now, edit the file with your settings using a text editor like `nano`.

```bash
nano .env.local
```

Fill in all your details, especially your `POSTGRES_URL`, `SESSION_SECRET`, and `NEXTAUTH_URL`. **Important:** For `POSTGRES_URL`, use your server's network IP address, not `localhost`.

**Step 4: Initialize the Database**
This one-time command starts a temporary container and mounts your local configuration file into it. This connects to your database, sets up the required tables, and lets you create your first admin user.

*Note: This command uses `-v` to mount the config file, as this is required for the script to read it.*

```bash
docker run --rm -it -v $(pwd)/.env.local:/app/.env.local ghcr.io/nothgm/uniplatetracker:main npm run db:init
```

Follow the interactive prompts to add your primary admin email address.

**Step 5: Launch UniPlateTracker**
This command will pull the latest version of the `:main` application image and start it in the background.

```bash 
docker compose pull && docker compose up -d
```


**Step 6: Configure the UniFi Protect Webhook**
Follow the same webhook setup instructions from Step 8 in the manual guide above to point UniFi Protect to `http://[YOUR_SERVER_IP]:[WORKER_PORT]/webhook`.

Your UniPlateTracker instance is now running!
*   **Web Interface:** `http://<your_server_ip>:3000`
*   **Webhook Endpoint:** `http://<your_server_ip>:4000`
*   **View Logs:** `docker compose logs -f`
*   **Stop Application:** `docker compose down`

---

## 🔧 Troubleshooting

### Detections show "No clip" in the Video column

The detection was recorded, but no video file exists for it on disk. Plate
detection and video capture are separate paths — the webhook writes the row,
and the worker records the clip from the camera's RTSP stream — so capture can
fail while detections carry on arriving normally. That makes this failure easy
to miss, which is why the UI labels it rather than showing a broken image.

Note the difference between the two empty states: a **dashed "No clip"** tile
means a clip was expected and is missing, while a **plain camera icon** means
the detection never referenced one.

Check, in order:

1.  **Is anything being written?** `ls -lt` the directory in
    `VIDEO_FINAL_CAPTURE_PATH` and look at the newest file's date. If it
    stopped on a particular day, something changed that day.
2.  **Is FFmpeg still present and working?** `ffmpeg -version`. A system
    upgrade can remove it or change its path.
3.  **Are the camera credentials still valid?** An expired UniFi Protect
    password or a rotated RTSP URL stops capture while leaving webhooks intact,
    because the NVR pushes those and does not need the app to authenticate.
4.  **Are both background processes alive?** The worker and the buffer manager
    are separate processes. `pm2 list` should show both, or
    `docker compose logs -f` for Docker. A crashed buffer manager stops clips
    without stopping detections.
5.  **Can the app read the directory?** It must be readable by the user running
    the app, which is not necessarily the user that created it.

### Video and thumbnails return 404

The API only serves files whose names contain letters, digits, dots, hyphens
and underscores, and only `.mp4` and `.jpg` extensions. It also refuses any
path that changes when normalised, so directory traversal fails rather than
escaping the capture directory. If a legitimate file 404s, check its name for
characters outside that set.

### Vehicle details show "Unknown"

The DVLA holds no record for that registration, or the lookup failed. This is
shown as a hollow, dashed chip rather than as a status, because it means the
information is absent rather than that the vehicle is compliant. Non-UK plates
will always show this unless `ENABLE_INTERNATIONAL_API` is configured.