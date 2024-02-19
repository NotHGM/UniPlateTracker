from flask import Flask, Response, request, jsonify, send_from_directory
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from flask_cors import CORS
from config import DB_HOST, DB_NAME, DB_USER, DB_PASS, DB_PORT, \
                   ENABLE_VIDEO_CAPTURE

app = Flask(__name__)
CORS(app)

# Configure logging
import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


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

@app.route('/view_data', methods=['GET'])
def view_data():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Retrieve query parameters
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    offset = (page - 1) * limit
    make = request.args.get('make', '')
    color = request.args.get('color', '')
    year = request.args.get('year', '')
    fuelType = request.args.get('fuelType', '')
    tax = request.args.get('tax', '')
    mot = request.args.get('mot', '')

    try:
        # Construct query with parameters
        query = """
        SELECT plate_number, MIN(capture_time) AS first_capture_time,
               MAX(recent_capture_time) AS recent_capture_time, image_data,
               car_make, car_color, fuel_type, mot_status, tax_status,
               year_of_manufacture, video_url
        FROM license_plates
        WHERE (%s = '' OR car_make = %s)
        AND (%s = '' OR car_color = %s)
        AND (%s = '' OR year_of_manufacture::text = %s)
        AND (%s = '' OR fuel_type = %s)
        AND (%s = '' OR tax_status = %s)
        AND (%s = '' OR mot_status = %s)
        GROUP BY plate_number, image_data, car_make, car_color, fuel_type, mot_status, tax_status, year_of_manufacture, video_url
        ORDER BY recent_capture_time DESC
        LIMIT %s OFFSET %s
        """
        cursor.execute(query, (make, make, color, color, year, year, fuelType, fuelType, tax, tax, mot, mot, limit, offset))

        rows = cursor.fetchall()

        # Calculate the total number of pages
        cursor.execute('SELECT COUNT(*) FROM license_plates')
        total_rows = cursor.fetchone()['count']
        total_pages = (total_rows + limit - 1) // limit

        # Format data for JSON response
        data = [{
            'plate_number': row['plate_number'],
            'first_capture_time': row['first_capture_time'].strftime("%Y-%m-%d %H:%M:%S") if row['first_capture_time'] else None,
            'recent_capture_time': row['recent_capture_time'].strftime("%Y-%m-%d %H:%M:%S") if row['recent_capture_time'] else None,
            'image_data': row['image_data'],
            'car_make': row['car_make'],
            'car_color': row['car_color'],
            'fuel_type': row['fuel_type'],
            'mot_status': row['mot_status'],
            'tax_status': row['tax_status'],
            'year_of_manufacture': row['year_of_manufacture'],
            'video_url': row['video_url']
        } for row in rows]

        return jsonify({'data': data, 'total_pages': total_pages, 'current_page': page})

    except Exception as e:
        logging.error(f"Error in view_data endpoint: {e}")
        return jsonify({'error': 'An error occurred fetching data'}), 500

    finally:
        cursor.close()
        conn.close()

@app.route('/video/<plate_number>')
def serve_video(plate_number):
    video_directory = 'videos'  # Directory where videos are stored
    video_filename = f'{plate_number}.mp4'  # Construct the video filename based on the plate number

    # Check if the file exists
    if os.path.exists(os.path.join(video_directory, video_filename)):
        return send_from_directory(video_directory, video_filename)
    else:
        return "Video not found", 404
        
@app.route('/plate_counts', methods=['GET'])
def plate_counts():
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Count for the last 24 hours
        cursor.execute("SELECT COUNT(DISTINCT plate_number) as count FROM license_plates WHERE capture_time > NOW() - INTERVAL '24 hours'")
        count_24h = cursor.fetchone()
        count_24h = count_24h['count'] if count_24h else 0

        # Count for the last 48 hours
        cursor.execute("SELECT COUNT(DISTINCT plate_number) as count FROM license_plates WHERE capture_time > NOW() - INTERVAL '48 hours'")
        count_48h = cursor.fetchone()
        count_48h = count_48h['count'] if count_48h else 0

        # Count for the last 7 days
        cursor.execute("SELECT COUNT(DISTINCT plate_number) as count FROM license_plates WHERE capture_time > NOW() - INTERVAL '7 days'")
        count_7d = cursor.fetchone()
        count_7d = count_7d['count'] if count_7d else 0

        # Count for the last 31 days
        cursor.execute("SELECT COUNT(DISTINCT plate_number) as count FROM license_plates WHERE capture_time > NOW() - INTERVAL '31 days'")
        count_31d = cursor.fetchone()
        count_31d = count_31d['count'] if count_31d else 0

        # Total count of unique plates
        cursor.execute("SELECT COUNT(DISTINCT plate_number) as total_count FROM license_plates")
        total_count = cursor.fetchone()
        total_count = total_count['total_count'] if total_count else 0

    except Exception as e:
        logging.error(f"Error in plate_counts endpoint: {e}")
        return jsonify({'error': 'An error occurred counting plates'}), 500

    finally:
        cursor.close()
        conn.close()

    return jsonify({
        'count_24h': count_24h,
        'count_48h': count_48h,
        'count_7d': count_7d,
        'count_31d': count_31d,
        'total_count': total_count
    })
    
@app.route('/video_capture_enabled', methods=['GET'])
def video_capture_enabled():
    return jsonify({'enabled': ENABLE_VIDEO_CAPTURE})

@app.route('/last_update_time', methods=['GET'])
def last_update_time():
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT MAX(capture_time) as last_time FROM license_plates")
        last_time = cursor.fetchone()
        return jsonify({'last_update_time': last_time['last_time'].isoformat() if last_time['last_time'] else None})

    except Exception as e:
        logging.error(f"Error fetching last update time: {e}")
        return jsonify({'error': 'An error occurred'}), 500

    finally:
        cursor.close()
        conn.close()

@app.route('/filter_data', methods=['GET'])
def filter_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT DISTINCT car_make FROM license_plates")
        car_makes = [row['car_make'] for row in cursor.fetchall() if row['car_make']]

        cursor.execute("SELECT DISTINCT car_color FROM license_plates")
        car_colors = [row['car_color'] for row in cursor.fetchall() if row['car_color']]
        
        cursor.execute("SELECT DISTINCT year_of_manufacture FROM license_plates")
        years = [row['year_of_manufacture'] for row in cursor.fetchall() if row['year_of_manufacture']]

        cursor.execute("SELECT DISTINCT fuel_type FROM license_plates")
        fuel_types = [row['fuel_type'] for row in cursor.fetchall() if row['fuel_type']]

        return jsonify({'car_makes': car_makes, 'car_colors': car_colors, 'years': years, 'fuel_types': fuel_types})

    except Exception as e:
        logging.error(f"Error in filter_data endpoint: {e}")
        return jsonify({'error': 'An error occurred fetching filter data'}), 500
        
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
