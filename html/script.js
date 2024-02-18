document.addEventListener('DOMContentLoaded', function() {
    fetchData();
    fetchAndDisplayCounts();
    setupDarkModeToggle();
    fetchFilterData();
    applySavedDarkModeState();
    pollForUpdates();
});

let currentPage = 1;
let currentFilters = {
    make: '',
    color: '',
    year: '',
    fuelType: '',
    tax: '',
    mot: ''
};

function fetchData() {
    const limit = 10;
    const url = `YOUR-SERVER-URL:5000/view_data?page=${currentPage}&limit=${limit}&make=${currentFilters.make}&color=${currentFilters.color}&year=${currentFilters.year}&fuelType=${currentFilters.fuelType}&tax=${currentFilters.tax}&mot=${currentFilters.mot}`;
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                populateTable(data);
                updatePageCounter();
            } else {
                console.error('No data received');
            }
        })
        .catch(error => console.error('Error fetching data:', error));
}

function changePage(increment) {
    currentPage += increment;
    if (currentPage < 1) currentPage = 1;
    fetchData();
}

function updatePageCounter() {
    document.getElementById('currentPage').innerText = currentPage;
}

let lastUpdateTime = null;

function pollForUpdates() {
    setInterval(() => {
        fetch('YOUR-SERVER-URL:5000/last_update_time')
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
    fetch('YOUR-SERVER-URL:5000/filter_data')
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
    currentPage = 1;
    currentFilters.make = document.getElementById('carMakeFilter').value;
    currentFilters.color = document.getElementById('carColorFilter').value;
    currentFilters.year = document.getElementById('yearOfManufactureFilter').value;
    currentFilters.fuelType = document.getElementById('fuelTypeFilter').value;
    currentFilters.tax = document.getElementById('taxStatusFilter').value;
    currentFilters.mot = document.getElementById('motStatusFilter').value;
    fetchData();
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
    fetch('YOUR-SERVER-URL:5000/plate_counts')
        .then(response => response.json())
        .then(data => {
            document.getElementById('count24h').textContent = data.count_24h || '0';
            document.getElementById('count48h').textContent = data.count_48h || '0';
            document.getElementById('count7d').textContent = data.count_7d || '0';
            document.getElementById('count31d').textContent = data.count_31d || '0';
            document.getElementById('totalPlatesCount').textContent = data.total_count || '0';
        })
        .catch(error => console.error('Error fetching plate counts:', error));
}

function searchLicensePlates() {
    let input = document.getElementById('searchBar');
    let filter = input.value.toUpperCase();
    let table = document.getElementById('data-table');
    let tr = table.getElementsByTagName('tr');

    for (let i = 0; i < tr.length; i++) {
        let tdArray = tr[i].getElementsByTagName('td');
        if (tdArray.length > 0) {
            let textContent = Array.from(tdArray).map(td => td.textContent).join(' ').toUpperCase();
            tr[i].style.display = textContent.indexOf(filter) > -1 ? '' : 'none';
        }
    }
}
