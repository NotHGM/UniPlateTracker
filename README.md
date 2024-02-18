# UniPlateTracker

> [!CAUTION]
> THIS IS A DEVEOLPMENT BRANCH FEATURES MAY NOT BE WORKING SO PLEASE MAKE SURE YOU ONLY DOWNLOAD THE MAIN BRANCH!

## Overview
The UniPlateTracker is a web application for monitoring and displaying information about license plates captured by a UniFi Protect camera with AI license plate detection. It processes license plate data, interacts with the DVLA API for vehicle details, and presents the information in a user-friendly interface. The system supports filtering, searching, and real-time data updates.

## Features
- Real-time fetching and display of license plate information.
- Integration with DVLA API for detailed vehicle info.
- Dark mode for user experience.
- Filters and search functionality.
- Automated updates for new data.

## Screenshots

Below are some example screenshots of the Number Plate Dashboard. Please note that the plates, dates, and details shown in these images are purely examples and do not represent real plate information or times.

![Screenshot 1](https://github.com/NotHGM/UniPlateTracker/blob/main/screenshots/Dark%20Mode%20-%20Example.png?raw=true)
*This is the dashboard in dark mode.*

![Screenshot 2](https://github.com/NotHGM/UniPlateTracker/blob/main/screenshots/Light%20Mode%20-%20Example.png?raw=true)
*This is the dashboard in light mode.*


## Installation
### Setting up the Database
Run the provided Python script (`create_db.py`) to set up the necessary tables in your PostgreSQL database.

### Prerequisites
- Python 3.x
- pip (Python package manager)
- PostgreSQL database
- A Unifi Protect Camera with AI license plate detection. [Learn more about Unifi Protect](https://unifi-protect.ui.com/).
- Home Assistant setup for integrating smart home devices. [Home Assistant Official Site](https://www.home-assistant.io/).
- HTTP server (for hosting the web interface)

> [!NOTE]
> This project was tested on Debian 12 Linux using Python version 3.11.2 and pip version 23.0.1, as well as on Windows 11 using Python Version 3.12.1 and pip version 23.2.1. It's important to ensure compatibility if using different environments or versions.


### Setting Up
1. Clone the repository:
```
git clone https://github.com/NotHGM/UniPlateTracker.git
```

3. Navigate to the project directory:
```
cd UniPlateTracker
```

4. Install the required Python packages:
```
pip install -r requirements.txt
```

5. Configure the database connection and other environment variables as needed. See the [Configuration guide](#configuration) for more details.

### Running the Application
> [!NOTE]
>For an optimal experience, I highly recommend deploying this application on a Linux environment. Utilizing ``tmux`` for session management can significantly enhance the handling and stability of the application.

To run the application, execute:
```
python backend.py
```

2. In a separate terminal, run the background tasks:
```
python background_tasks.py
```
## Hosting the Front-end

To host the front-end of the application, you will need to use an HTTP server. For development purposes, Python's built-in HTTP server can be quite handy. Follow these steps:

1. Navigate to the `html` directory where your front-end files are located:
```
cd UniPlateTracker/html
```
2. Run Python's built-in HTTP server:
```
python -m http.server
```
This will serve your front-end files on a local web server.

## Configuration

To configure the application, you need to update the settings in `backend.py` and `background_tasks.py` files. These files contain the necessary configurations for the application to function correctly.

1. **Database Connection Details**: Set up your database connection details including the host, database name, user, and password.

2. **Home Assistant API URL and Token**: Provide the URL for your Home Assistant API and the Long-Lived Access Token. This is essential for fetching license plate data from your camera.

3. **DVLA API Key**: Enter your DVLA API key. This key is used to fetch vehicle details based on the license plate number.

4. **Camera Sensor Name**: Specify the `states/sensor.CAMERA-SENSOR-NAME` for your UniFi Protect camera. This is used to identify which camera sensor data should be fetched.

Make sure to update these details according to your setup for the application to work properly.

## Usage
After starting the backend and frontend, navigate to `http://localhost:8000` (or your configured HTTP server port).

### Dashboard Features
- **View License Plates**: Table with license plate details.
- **Search and Filters**: Narrow down records using search and filters.
- **Dark Mode**: Toggle between light and dark themes.

## To-Do List

Here are some features and enhancements planned for future updates:

- [X] Pagination: Implement pagination for the displayed license plate data to enhance user experience, especially when dealing with a large number of records.
- [X] Fix Recent Capture Time: Address issues with the display of recent capture times to ensure accuracy and consistency in the data presented.
- [ ] Correct Plate Characters Function: Fix the `correct_plate_characters` function to ensure it accurately transforms specific characters in certain positions of the license plate.

## Credits
- [Python](https://www.python.org/) - Programming language used.
- [Flask](https://pypi.org/project/Flask/) - Web framework for Python.
- [PostgreSQL](https://www.postgresql.org/) - Database used.
- [Home Assistant](https://www.home-assistant.io/) - For smart home integration.
- [Unifi Protect](https://unifi-protect.ui.com/) - Camera system with AI license plate detection.
- [DVLA](https://www.gov.uk/government/organisations/driver-and-vehicle-licensing-agency) - For vehicle data lookup in the UK.

## Contributing
Contributions are welcome. Follow the project's coding standards and submit pull requests for new features or fixes.

## License
Licensed under the [MIT License](LICENSE).

## Disclaimer
For educational purposes. Comply with local laws regarding surveillance and data processing.

> [!NOTE]
> - This is my first big project and the first time I've really gotten into Python. I'm still figuring things out, so if you see ways to make it better, feel free to jump in with a pull request. All ideas and fixes are welcome!
> - You will still need to create database & the username
> - This application was initially developed for use in the UK and is tailored to UK license plates and the DVLA system. However, it can be forked and adjusted for different countries and their respective vehicle licensing systems.
> - Requires a UniFi Protect camera with AI license plate detection functionality.

