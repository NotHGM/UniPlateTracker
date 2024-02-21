# UniPlateTracker

> [!WARNING]
> Video Capture is currently non-functional so please do not enable it in `config.py`.

## Overview
UniPlateTracker is a web application for monitoring and displaying information about license plates captured by a UniFi Protect camera with AI license plate detection. It processes license plate data, interacts with the DVLA API for vehicle details, and presents the information in a user-friendly interface. The system supports filtering, searching, real-time data updates, and local video storage for each detected plate.

## Features
- Real-time fetching and display of license plate information.
- Integration with DVLA API for detailed vehicle information.
- Dark mode for improved user experience.
- Filters and search functionality for easy data navigation.
- Automated updates for new data.
- Video capture of each detected plate with local storage (configurable).

## Screenshots
Below are some example screenshots of the Number Plate Dashboard. Please note that the plates, dates, and details shown in these images are purely examples and do not represent real plate information or times.
- ![Screenshot 1](https://github.com/NotHGM/UniPlateTracker/blob/main/screenshots/Dark%20Mode%20-%20Example.png?raw=true)
  *Dashboard in dark mode.*
- ![Screenshot 2](https://github.com/NotHGM/UniPlateTracker/blob/main/screenshots/Light%20Mode%20-%20Example.png?raw=true)
  *Dashboard in light mode.*

## Installation
### Setting up the Database
Run the provided Python script (`create_db.py`) to set up the necessary tables in your PostgreSQL database.

### Prerequisites
- Python 3.x and pip (Python package manager).
- PostgreSQL database.
- UniFi Protect Camera with AI license plate detection. [Learn more](https://unifi-protect.ui.com/).
- Home Assistant setup. [Home Assistant Official Site](https://www.home-assistant.io/).
- HTTP server (for hosting the web interface).

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
### config.py
Edit the `config.py` file in the root directory with the following configurations:
- Database Connection: Host, database name, user, password.
- Home Assistant API: URL and Long-Lived Access Token.
- DVLA API Key: For fetching vehicle details.
- Camera Sensor Name: Sensor name in Home Assistant for the UniFi Protect camera.
- Video Capture: Enable or disable local video capture. Videos are saved locally but can be disabled in the config.

### Additional Notes
- Videos are saved locally to the system running UniPlateTracker. This feature can be enabled or disabled in the `config.py` & if you set it to `True` or `False` you will have to restart `backend.py`.
- Ensure all configurations are set according to your environment.

## Usage
After starting the backend and frontend, navigate to `http://localhost:8000` or your configured HTTP server port.

### Dashboard Features
- View License Plates: Table with license plate details.
- Search and Filters: For narrowing down records.
- Dark Mode: Toggle between light and dark themes.
- Video Playback: View locally stored videos for each plate detection.

## To-Do/Fix
- [ ] Fix Video Capture
- [ ] Fix Returning Colour from DVLA API
- [ ] Fix `undefined` when changing pages


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

