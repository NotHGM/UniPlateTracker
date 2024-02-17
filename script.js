document.addEventListener('DOMContentLoaded', function() {
    fetchData();
    fetchAndDisplayCounts();
    setupDarkModeToggle();
    fetchFilterData();
    applySavedDarkModeState();
    pollForUpdates();
});

function fetchData() {
    fetch('YOUR_SERVER_URL/view_data')
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                populateTable(data);
            } else {
                console.error('No data received');
            }
        })
        .catch(error => console.error('Error fetching data:', error));
}

let lastUpdateTime = null;

function pollForUpdates() {
    setInterval(() => {
        fetch('YOUR_SERVER_URL/last_update_time')
            .then(response => response.json())
            .then(data => {
                if (data.last_update_time && data.last_update_time !== lastUpdateTime) {
                    lastUpdateTime = data.last_update_time;
                    fetchData();
                }
            })
            .catch(error => console.error('Error polling for updates:', error));
    }, 10000);
}

function populateTable(data) {
    const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';
    data.forEach(row => {
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td><div class="license-plate-container"><span class="license-plate">${formatLicensePlate(row.plate_number)}</span></div></td>
            <td>${row.first_capture_time}</td>
            <td>${row.recent_capture_time}</td>
            <td>${getImageHtml(row.image_data)}</td>
            <td>
                Make: ${row.car_make || 'N/A'}<br>
                Color: ${row.car_color || 'N/A'}<br>
                Year: ${row.year_of_manufacture || 'N/A'}<br>
                Fuel Type: ${row.fuel_type || 'N/A'}<br>
                Tax: ${formatTaxStatus(row.tax_status)}<br>
                MOT: ${formatMOTStatus(row.mot_status)}
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function fetchFilterData() {
    fetch('YOUR_SERVER_URL/filter_data')
    .then(response => response.json())
    .then(data => {
        populateFilterOptions('carMakeFilter', data.car_makes, 'Car Make');
        populateFilterOptions('carColorFilter', data.car_colors, 'Car Color');
        populateFilterOptions('yearOfManufactureFilter', data.years, 'Year of Manufacture');
        populateFilterOptions('fuelTypeFilter', data.fuel_types, 'Fuel Type');
        setupFilterListeners();
    })
    .catch(error => console.error('Error fetching filter data:', error));
}

function populateFilterOptions(filterId, options, defaultText) {
const select = document.getElementById(filterId);
if (select) {
    select.innerHTML = `<option value="">${defaultText}</option>`;
    options.forEach(option => {
        if (option) {
            const opt = document.createElement('option');
            opt.value = opt.textContent = option;
            select.appendChild(opt);
        }
    });
}
}

function formatTaxStatus(status) {
    return status === 'Taxed' ? `<span style="color: green;">${status}</span>` : `<span style="color: red;">${status || 'N/A'}</span>`;
}

function formatMOTStatus(status) {
    return status === 'Valid' ? `<span style="color: green;">${status}</span>` : `<span style="color: red;">${status || 'N/A'}</span>`;
}

function getImageHtml(imageData) {
    if (imageData) {
        return `<img src="data:image/jpeg;base64,${imageData}" height="100">`;
    }
    return `<img src="image-not-available.jpg" height="100">`;
}

function formatLicensePlate(plate) {
    if (plate && plate.length > 4) {
        return plate.slice(0, 4) + ' ' + plate.slice(4);
    }
    return plate;
}

function setupFilterListeners() {
    document.getElementById('carMakeFilter').addEventListener('change', applyFilters);
    document.getElementById('carColorFilter').addEventListener('change', applyFilters);
    document.getElementById('yearOfManufactureFilter').addEventListener('change', applyFilters);
    document.getElementById('taxStatusFilter').addEventListener('change', applyFilters);
    document.getElementById('motStatusFilter').addEventListener('change', applyFilters);
}

function applyFilters() {
    const makeValue = document.getElementById('carMakeFilter').value;
    const colorValue = document.getElementById('carColorFilter').value;
    const yearValue = document.getElementById('yearOfManufactureFilter').value;
    const taxValue = document.getElementById('taxStatusFilter').value;
    const motValue = document.getElementById('motStatusFilter').value;

    const table = document.getElementById('data-table');
    const rows = table.getElementsByTagName('tr');

    for (let i = 1; i < rows.length; i++) { // Start from 1 to skip the header row
        const row = rows[i];
        const td = row.getElementsByTagName('td');
        const makeMatches = makeValue === '' || (td[4] && td[4].textContent.includes(`Make: ${makeValue}`));
        const colorMatches = colorValue === '' || (td[4] && td[4].textContent.includes(`Color: ${colorValue}`));
        const yearMatches = yearValue === '' || (td[4] && td[4].textContent.includes(`Year: ${yearValue}`));
        const taxMatches = taxValue === '' || (td[4] && td[4].textContent.includes(`Tax: ${taxValue}`));
        const motMatches = motValue === '' || (td[4] && td[4].textContent.includes(`MOT: ${motValue}`));

        if (makeMatches && colorMatches && yearMatches && taxMatches && motMatches) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    }
}

function setupDarkModeToggle() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    darkModeToggle.addEventListener('change', function() {
        document.body.classList.toggle('dark-mode', this.checked);
        localStorage.setItem('darkMode', this.checked);
    });
}

function applySavedDarkModeState() {
    const darkModeState = localStorage.getItem('darkMode');
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeState !== null) {
        const isDarkMode = darkModeState === 'true';
        document.body.classList.toggle('dark-mode', isDarkMode);
        darkModeToggle.checked = isDarkMode;
    }
}

function fetchAndDisplayCounts() {
    fetch('YOUR_SERVER_URL/plate_counts')
        .then(response => response.json())
        .then(data => {
            document.getElementById('count24h').textContent = data.count_24h || '0';
            document.getElementById('count48h').textContent = data.count_48h || '0';
            document.getElementById('count7d').textContent = data.count_7d || '0';
            document.getElementById('count31d').textContent = data.count_31d || '0';
        })
        .catch(error => console.error('Error fetching plate counts:', error));
}

// Implement the filtering logic in applyFilters
function applyFilters() {
    const makeValue = document.getElementById('carMakeFilter').value;
    const colorValue = document.getElementById('carColorFilter').value;
    const yearValue = document.getElementById('yearOfManufactureFilter').value;
    const fuelTypeValue = document.getElementById('fuelTypeFilter').value;
    const taxValue = document.getElementById('taxStatusFilter').value;
    const motValue = document.getElementById('motStatusFilter').value;

    const table = document.getElementById('data-table');
    const rows = table.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowData = row.getElementsByTagName('td');

        // Extract values from specific columns
        const makeMatches = makeValue === '' || (rowData[4] && rowData[4].innerText.includes(`Make: ${makeValue}`));
        const colorMatches = colorValue === '' || (rowData[4] && rowData[4].innerText.includes(`Color: ${colorValue}`));
        const yearMatches = yearValue === '' || (rowData[4] && rowData[4].innerText.includes(`Year: ${yearValue}`));
        const fuelTypeMatches = fuelTypeValue === '' || (rowData[4] && rowData[4].innerText.includes(`Fuel Type: ${fuelTypeValue}`)); 
        const taxMatches = taxValue === '' || (rowData[4] && rowData[4].innerText.includes(`Tax: ${taxValue}`));
        const motMatches = motValue === '' || (rowData[4] && rowData[4].innerText.includes(`MOT: ${motValue}`));

        if (makeMatches && colorMatches && yearMatches && fuelTypeMatches && taxMatches && motMatches) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    }
}
