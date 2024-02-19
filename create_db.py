import psycopg2
from psycopg2 import sql
import os

# Database connection parameters - update these with your database details
db_params = {
    "dbname": "licenseplatestestforgithub",
    "user": "testforgithub",
    "password": "Georgetay329",
    "host": "192.168.1.180",  # or the IP address of your PostgreSQL server
    "port": 5432
}

# SQL command to create the license_plates table
create_table_command = """
CREATE TABLE IF NOT EXISTS license_plates (
    id SERIAL PRIMARY KEY,
    plate_number VARCHAR(255) NOT NULL,
    capture_time TIMESTAMP NOT NULL,
    recent_capture_time TIMESTAMP NOT NULL,
    image_data TEXT,
    car_make VARCHAR(255),
    car_color VARCHAR(255),
    fuel_type VARCHAR(255),
    video_url VARCHAR(255),   
    mot_status VARCHAR(50),
    tax_status VARCHAR(50),
    year_of_manufacture INT
);
"""

try:
    # Connect to the database
    conn = psycopg2.connect(**db_params)
    cur = conn.cursor()
    print("Connected to the database.")

    # Create the table
    cur.execute(create_table_command)
    conn.commit()
    print("Table created successfully.")

except Exception as e:
    print(f"An error occurred: {e}")

finally:
    if conn:
        cur.close()
        conn.close()
        print("Database connection closed.")

