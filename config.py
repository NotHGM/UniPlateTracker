# Database Configuration
DB_HOST = 'DB-HOST'
DB_NAME = 'DB-NAME'
DB_USER = 'DB-USER'
DB_PASS = 'DB-PASS'
DB_PORT = 'DB-PORT'

# Home Assistant API Configuration
HOME_ASSISTANT_API = 'HOME-ASSITANT-URL/api'
LONG_LIVED_ACCESS_TOKEN = 'LONG-LIVED-ACCESS-TOKEN'
HOME_ASSISTANT_SENSOR_NAME = 'sensor.CAMERA-NAME'

# Background Task Poll Rate
BACKGROUND_TASK_POLL_RATE = 10  # in seconds

# DVLA API Configuration
API_KEY_DVLA = 'DVLA-API-KEY'

# RTSP Stream URL
RTSP_URL = 'RTSP-URL'

# Video Capture Configuration (STILL IN EARLY BETA TESTING)
VIDEOS_DIR = 'videos'
ENABLE_VIDEO_CAPTURE = False # DO NOT SET TO TRUE UNTIL VERSION 1.0.0

# Buffer settings for pre-capture video
BUFFER_DURATION_SECONDS = 5  # Buffer duration in seconds before detection
FPS = 20  # Approximate frames per second of the RTSP stream
