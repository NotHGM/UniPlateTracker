from flask import Flask, request, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
import base64
import logging
import time
import queue
import threading
import cv2
import requests
import json
from datetime import datetime, timedelta
import os
from config import DB_HOST, DB_NAME, DB_USER, DB_PASS, DB_PORT, \
                   HOME_ASSISTANT_API, LONG_LIVED_ACCESS_TOKEN, \
                   API_KEY_DVLA, RTSP_URL, VIDEOS_DIR, ENABLE_VIDEO_CAPTURE, \
                   HOME_ASSISTANT_SENSOR_NAME, BACKGROUND_TASK_POLL_RATE, \
                   BUFFER_DURATION_SECONDS, FPS 

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Ensure video directory exists
if not os.path.exists(VIDEOS_DIR):
    os.makedirs(VIDEOS_DIR)

# Database connection
def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST, database=DB_NAME, user=DB_USER, 
        password=DB_PASS, port=DB_PORT, cursor_factory=RealDictCursor
    )

# Fetch vehicle details from DVLA API
def get_vehicle_details(registration_number):
    api_url = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles'
    headers = {'x-api-key': API_KEY_DVLA, 'Content-Type': 'application/json'}
    data = {'registrationNumber': registration_number}
    response = requests.post(api_url, headers=headers, json=data)
    return response.json() if response.status_code == 200 else None

# Capture an image from the camera
def fetch_image():
    cap = cv2.VideoCapture(RTSP_URL)
    if not cap.isOpened():
        logging.error('Failed to open RTSP stream')
        return None
    ret, frame = cap.read()
    if not ret:
        logging.error('Failed to fetch frame from RTSP stream')
        return None
    _, buffer = cv2.imencode('.jpg', frame)
    return base64.b64encode(buffer).decode('utf-8')
    
def process_plate_data(license_plate, capture_time):
    if not license_plate:
        logging.error("No license plate data to process.")
        return

    original_plate = license_plate
    print(f"Original Plate: {original_plate}")

    def replace_zero_with_O(license_plate):
        modified_plate = ''
        for i, char in enumerate(license_plate):
            if char == '0' and not (i == 2 or i == 5):
                modified_plate += 'O'
            else:
                modified_plate += char
        return modified_plate

    plate_after_zero_replacement = replace_zero_with_O(original_plate)
    print(f"Plate after replacing zeros: {plate_after_zero_replacement}")

    def correct_plate_characters(license_plate):
        char_map = {'0': 'O', '1': 'I', '4': 'A', '5': 'S', '7': 'T', '8': 'B'}
        positions = [0, 1, 4, 5, 6]  # Adjusted positions for 7-digit plates
        return ''.join([char_map.get(char, char) if i in positions else char for i, char in enumerate(license_plate)])

    corrected_plate = correct_plate_characters(plate_after_zero_replacement)
    print(f"Final Corrected Plate (Sent to DVLA): {corrected_plate}")

    if not (7 <= len(corrected_plate) <= 8):
        logging.warning(f"Corrected license plate '{corrected_plate}' does not meet length constraints.")
        return

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT id, recent_capture_time FROM license_plates WHERE plate_number = %s', (license_plate,))
        plate = cursor.fetchone()

        # Fetch new image and video for each detection
        image_data = fetch_image()
        video_url = capture_video_snippet(license_plate, 10) if ENABLE_VIDEO_CAPTURE else None
        if plate:
            # Checking if the plate data needs to be updated
            if datetime.datetime.strptime(capture_time, '%Y-%m-%d %H:%M:%S') - plate['recent_capture_time'] > datetime.timedelta(days=3):
                vehicle_details = get_vehicle_details(license_plate)
                # Update vehicle details if new data is available
            if datetime.strptime(capture_time, '%Y-%m-%d %H:%M:%S') - plate['recent_capture_time'] > timedelta(days=3):
                vehicle_details = get_vehicle_details(license_plate)
                update_vehicle_details(cursor, plate['id'], vehicle_details)

            delete_old_video(plate['id'], cursor)

            cursor.execute('''UPDATE license_plates SET 
                              recent_capture_time = %s, 
                              image_data = %s, 
                              video_url = %s
                              WHERE id = %s''', 
                           (capture_time, image_data, video_url, plate['id']))
        else:
            vehicle_details = get_vehicle_details(license_plate)
            cursor.execute('''INSERT INTO license_plates (plate_number, capture_time, recent_capture_time, image_data, video_url,
                              car_make, car_color, fuel_type, mot_status, tax_status, year_of_manufacture, tax_due_date, mot_expiry_date)
                              VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
                           (license_plate, capture_time, capture_time, image_data, video_url,
                            vehicle_details.get('make'), vehicle_details.get('color'), 
                            vehicle_details.get('fuelType'), vehicle_details.get('motStatus'), 
                            vehicle_details.get('taxStatus'), vehicle_details.get('yearOfManufacture'),
                            vehicle_details.get('taxDueDate'), vehicle_details.get('motExpiryDate')))
        conn.commit()
    except Exception as e:
        logging.error(f"Error processing plate data: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

def update_vehicle_details(cursor, plate_id, vehicle_details):
    cursor.execute('''UPDATE license_plates SET 
                      car_make = %s, 
                      car_color = %s, 
                      fuel_type = %s, 
                      mot_status = %s, 
                      tax_status = %s, 
                      year_of_manufacture = %s,
                      tax_due_date = %s,
                      mot_expiry_date = %s
                      WHERE id = %s''',
                   (vehicle_details.get('make'), vehicle_details.get('color'), 
                    vehicle_details.get('fuelType'), vehicle_details.get('motStatus'), 
                    vehicle_details.get('taxStatus'), vehicle_details.get('yearOfManufacture'),
                    vehicle_details.get('taxDueDate'), vehicle_details.get('motExpiryDate'),
                    plate_id))

def delete_old_video(plate_id, cursor):
    cursor.execute('SELECT video_url FROM license_plates WHERE id = %s', (plate_id,))
    video = cursor.fetchone()
    if video and video['video_url']:
        old_video_path = os.path.join(VIDEOS_DIR, video['video_url'].split('/')[-1])
        if os.path.exists(old_video_path):
            os.remove(old_video_path)

def buffer_rtsp_stream(frame_queue):
    """
    Continuously read from RTSP stream and store frames in a queue.
    :param frame_queue: A queue object to store frames.
    """
    cap = cv2.VideoCapture(RTSP_URL)
    while True:
        ret, frame = cap.read()
        if ret:
            if frame_queue.full():
                frame_queue.get()  # Remove oldest frame if the queue is full
            frame_queue.put((datetime.now(), frame))  # Store timestamp and frame

# Global queue to hold frames
frame_queue = queue.Queue(maxsize=100)  # Adjust size as needed

# Start the buffering in a separate thread
threading.Thread(target=buffer_rtsp_stream, args=(frame_queue,), daemon=True).start()

def capture_video_snippet(license_plate, duration_seconds, pre_capture_duration=5):
    rtsp_url = RTSP_URL
    filename = f"{license_plate}_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}.mp4"
    output_file = os.path.join(VIDEOS_DIR, filename)

    cap = cv2.VideoCapture(rtsp_url)
    if not cap.isOpened():
        logging.error("Failed to open RTSP stream")
        return None

    # Get video properties for accurate VideoWriter configuration
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_file, fourcc, fps, (width, height))

    # Adjust start and end time for pre-capture
    start_time = datetime.now() - timedelta(seconds=pre_capture_duration)
    end_time = start_time + timedelta(seconds=duration_seconds)

    # Adjusted loop to capture video starting from start_time
    while datetime.datetime.now() < end_time:
        ret, frame = cap.read()
        if ret and datetime.datetime.now() >= start_time:
            out.write(frame)
        else:
            break

    cap.release()
    out.release()
    return filename

def fetch_license_plate_data():
    headers = {'Authorization': f'Bearer {LONG_LIVED_ACCESS_TOKEN}', 'Content-Type': 'application/json'}
    url = f"{HOME_ASSISTANT_API}states/{HOME_ASSISTANT_SENSOR_NAME}"
    response = requests.get(url, headers=headers, timeout=10)
    if response.status_code == 200 and response.json().get('state') != 'none':
        license_plate = response.json().get('state')
        capture_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        return license_plate, capture_time
    return None, None

def background_task():
    logging.info("Background task started.")
    try:
        while True:
            result = fetch_license_plate_data()
            if result:
                license_plate, capture_time = result
                logging.info(f"License Plate Detected: {license_plate}")
                process_plate_data(license_plate, capture_time)
            time.sleep(BACKGROUND_TASK_POLL_RATE)
    except KeyboardInterrupt:
        print("License Plate Polling has stopped")
        
@app.route('/add_plate_data_with_image', methods=['POST'])
def add_plate_data_with_image():
    data = request.json
    license_plate = data['plate_number']
    capture_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    process_plate_data(license_plate, capture_time)
    return jsonify({'message': 'Data processed'}), 200

if __name__ == '__main__':
    background_task()