from flask import Flask, request, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
import base64
import logging
import time
import queue
import cv2
import requests
import json
from datetime import datetime

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Database connection settings (Replace with your own settings)
DB_HOST = 'YOUR_DB_HOST'
DB_NAME = 'YOUR_DB_NAME'
DB_USER = 'YOUR_DB_USER'
DB_PASS = 'YOUR_DB_PASSWORD'
DB_PORT = 'YOUR_DB_PORT'

# Home Assistant API settings (Replace with your own settings)
HOME_ASSISTANT_API = 'YOUR_HOME_ASSISTANT_API'
LONG_LIVED_ACCESS_TOKEN = 'YOUR_LONG_LIVED_ACCESS_TOKEN'

# DVLA API Key (Replace with your own key)
API_KEY_DVLA = 'YOUR_API_KEY_DVLA'

# Camera frame rate and RTSP URL (Replace with your own settings)
CAMERA_FRAME_RATE = 30
RTSP_URL = 'YOUR_RTSP_URL'

# Headers for Home Assistant API
headers = {
    'Authorization': f'Bearer {LONG_LIVED_ACCESS_TOKEN}',
    'Content-Type': 'application/json'
}

def get_db_connection():
    """ Establish a connection to the database. """
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        port=DB_PORT,
        cursor_factory=RealDictCursor
    )

def get_vehicle_details(registration_number):
    """ Fetch vehicle details from DVLA API. """
    api_url = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles'
    dvla_headers = {
        'x-api-key': API_KEY_DVLA,
        'Content-Type': 'application/json'
    }
    data = {'registrationNumber': registration_number}
    response = requests.post(api_url, headers=dvla_headers, data=json.dumps(data))
    return response.json() if response.status_code == 200 else None

def fetch_image():
    """ Capture an image from the camera. """
    cap = cv2.VideoCapture(RTSP_URL)
    if not cap.isOpened():
        logging.error('Failed to open RTSP stream')
        return None

    target_frame_index = int(CAMERA_FRAME_RATE * 2)
    buffer = []
    for _ in range(target_frame_index + 1):
        ret, frame = cap.read()
        if not ret:
            logging.error('Failed to fetch frame from RTSP stream')
            cap.release()
            return None
        buffer.append(frame)
    cap.release()
    target_frame = buffer[-target_frame_index]
    _, buffer = cv2.imencode('.jpg', target_frame)
    return base64.b64encode(buffer).decode('utf-8')

def replace_zero_with_O(license_plate):
    """ Replace '0' with 'O' in license plate except for 4th and 5th characters. """
    modified_plate = ''
    for i, char in enumerate(license_plate):
        if char == '0' and not (i == 3 or i == 4):
            modified_plate += 'O'
        else:
            modified_plate += char
    return modified_plate

def correct_plate_characters(license_plate):
    """ Correct specific characters in certain positions of the license plate. """
    char_map = {'0': 'O', '1': 'I', '4': 'A', '5': 'S', '7': 'T', '8': 'B'}
    return ''.join([char_map.get(char, char) if i in [0, 1, 4, 5, 6] else char for i, char in enumerate(license_plate)])

def process_plate_data(license_plate, capture_time):
    """ Process license plate data. """
    corrected_plate = correct_plate_characters(license_plate)
    corrected_plate = replace_zero_with_O(corrected_plate)

    if not (7 <= len(license_plate) <= 8):
        logging.warning(f"License plate '{license_plate}' does not meet length constraints.")
        return

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT id, recent_capture_time FROM license_plates WHERE plate_number = %s', (corrected_plate,))
        existing_plate = cursor.fetchone()

        if existing_plate:
            # Convert capture_time to datetime object if it's a string
            if isinstance(capture_time, str):
                capture_time = datetime.strptime(capture_time, '%Y-%m-%d %H:%M:%S')

            # Compare datetime objects
            if existing_plate['recent_capture_time'] is None or existing_plate['recent_capture_time'] < capture_time:
                cursor.execute('UPDATE license_plates SET recent_capture_time = %s WHERE id = %s', (capture_time, existing_plate['id']))
        else:
            encoded_image = fetch_image()
            vehicle_details = get_vehicle_details(corrected_plate.replace(" ", ""))
            if encoded_image and vehicle_details:
                cursor.execute('''INSERT INTO license_plates (plate_number, capture_time, recent_capture_time, image_data,
                              car_make, car_color, fuel_type, mot_status, tax_status, year_of_manufacture)
                              VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id''',
                           (corrected_plate, capture_time, capture_time, encoded_image, vehicle_details.get('make', 'Unknown'),
                            vehicle_details.get('colour', 'Unknown'), vehicle_details.get('fuelType', 'Unknown'),
                            vehicle_details.get('motStatus', 'Unknown'), vehicle_details.get('taxStatus', 'Unknown'),
                            vehicle_details.get('yearOfManufacture')))
                plate_id = cursor.fetchone()['id']
                logging.info(f"Inserted new plate {corrected_plate}. ID: {plate_id}")
            else:
                logging.error('Failed to fetch vehicle details or image for new plate')

        conn.commit()
    except Exception as e:
        logging.error(f"Error processing plate data: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

@app.route('/add_plate_data_with_image', methods=['POST'])
def add_plate_data_with_image():
    """ Endpoint for adding plate data with image. """
    data = request.json
    license_plate = data['plate_number']
    capture_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    process_plate_data(license_plate, capture_time)
    return jsonify({'message': 'Data processed'}), 200

def fetch_license_plate_data():
    """ Fetch the latest license plate data from Home Assistant API. """
    global headers
    url = f"{HOME_ASSISTANT_API}states/sensor.REPLACE-WITH-YOUR-OWN-SENSOR-NAME"
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            license_plate = data.get('state')
            if license_plate and license_plate != 'none':
                capture_time = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())
                return license_plate, capture_time
        else:
            logging.error(f"Failed to fetch license plate data: {response.status_code}, {response.text}")
    except Exception as e:
        logging.error(f"Error making API call: {e}")

    return None, None

def background_task():
    """ Background task for polling new license plate data. """
    logging.info("Background task started.")
    while True:
        try:
            result = fetch_license_plate_data()
            if result is not None:
                license_plate, capture_time = result
                if license_plate:
                    logging.info(f"License Plate Detected: {license_plate}")
                    process_plate_data(license_plate, capture_time)
                else:
                    logging.info("No new license plate detected.")
            else:
                logging.error("No data received from Home Assistant API.")
        except Exception as e:
            logging.error(f"Error during polling: {e}")
        time.sleep(3) # Poll Rate for scanning the Home Assistant API

if __name__ == '__main__':
    background_task()
