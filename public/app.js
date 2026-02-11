// State
let stops = [];
let selectedDeparture = null;
let selectedDestination = null;
let availableTrams = [];
let selectedTrams = new Set();
let monitoringActive = false;
let monitoringInterval = null;

// DOM elements
const departureSelect = document.getElementById('departure-stop');
const destinationSelect = document.getElementById('destination-stop');
const tramSelectionGroup = document.getElementById('tram-selection-group');
const tramCheckboxesContainer = document.getElementById('tram-checkboxes');
const monitoringBtn = document.getElementById('monitoring-btn');
const resultsSection = document.getElementById('results-section');
const resultsContainer = document.getElementById('results');
const errorMessage = document.getElementById('error-message');

// Initialize
async function init() {
    try {
        const response = await fetch('/api/stops');
        if (!response.ok) {
            throw new Error('Не удалось загрузить список остановок');
        }
        
        const data = await response.json();
        stops = data.stops;
        
        // Sort stops alphabetically by name + direction
        stops.sort((a, b) => {
            const aLabel = `${a.name} (${a.direction})`;
            const bLabel = `${b.name} (${b.direction})`;
            return aLabel.localeCompare(bLabel, 'ru');
        });
        
        populateStopSelects();
    } catch (error) {
        showError('Ошибка при загрузке данных: ' + error.message);
    }
}

// Populate stop dropdowns
function populateStopSelects() {
    stops.forEach(stop => {
        const label = `${stop.name} (${stop.direction})`;
        
        const departureOption = document.createElement('option');
        departureOption.value = stop.uuid;
        departureOption.textContent = label;
        departureOption.dataset.name = stop.name;
        departureOption.dataset.direction = stop.direction;
        departureSelect.appendChild(departureOption);
        
        const destinationOption = document.createElement('option');
        destinationOption.value = stop.uuid;
        destinationOption.textContent = label;
        destinationOption.dataset.name = stop.name;
        destinationOption.dataset.direction = stop.direction;
        destinationSelect.appendChild(destinationOption);
    });
}

// Handle departure stop selection
departureSelect.addEventListener('change', async (e) => {
    const uuid = e.target.value;
    
    if (!uuid) {
        selectedDeparture = null;
        tramSelectionGroup.style.display = 'none';
        monitoringBtn.disabled = true;
        return;
    }
    
    selectedDeparture = stops.find(s => s.uuid === uuid);
    
    // Fetch available trams
    await fetchAvailableTrams();
});

// Handle destination stop selection
destinationSelect.addEventListener('change', () => {
    const uuid = destinationSelect.value;
    selectedDestination = uuid ? stops.find(s => s.uuid === uuid) : null;
    
    // If monitoring is active, update results with new filtering
    if (monitoringActive) {
        updateResults();
    }
});

// Fetch available trams for selected departure stop
async function fetchAvailableTrams() {
    try {
        showError('', false);
        
        const response = await fetch(`/api/stop/${selectedDeparture.uuid}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 477) {
                throw new Error(errorData.error);
            }
            throw new Error(`Ошибка ${response.status}: ${errorData.error || response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.routePath || data.routePath.length === 0) {
            showError('На этой остановке нет трамваев');
            tramSelectionGroup.style.display = 'none';
            monitoringBtn.disabled = true;
            return;
        }
        
        // Extract unique tram numbers
        const tramNumbers = [...new Set(data.routePath.map(route => route.number))];
        tramNumbers.sort((a, b) => {
            // Sort numerically if both are numbers, otherwise alphabetically
            const aNum = parseInt(a);
            const bNum = parseInt(b);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum;
            }
            return a.localeCompare(b, 'ru');
        });
        
        availableTrams = tramNumbers;
        populateTramCheckboxes();
        
        tramSelectionGroup.style.display = 'block';
        
    } catch (error) {
        showError(error.message);
        tramSelectionGroup.style.display = 'none';
        monitoringBtn.disabled = true;
    }
}

// Populate tram checkboxes
function populateTramCheckboxes() {
    tramCheckboxesContainer.innerHTML = '';
    selectedTrams.clear();
    
    availableTrams.forEach(tramNumber => {
        const label = document.createElement('label');
        label.className = 'tram-checkbox-label';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = tramNumber;
        checkbox.addEventListener('change', handleTramCheckboxChange);
        
        const text = document.createTextNode(tramNumber);
        
        label.appendChild(checkbox);
        label.appendChild(text);
        tramCheckboxesContainer.appendChild(label);
    });
}

// Handle tram checkbox changes
function handleTramCheckboxChange(e) {
    const tramNumber = e.target.value;
    
    if (e.target.checked) {
        selectedTrams.add(tramNumber);
    } else {
        selectedTrams.delete(tramNumber);
    }
    
    // Enable/disable monitoring button based on selection
    monitoringBtn.disabled = selectedTrams.size === 0;
}

// Handle monitoring button click
monitoringBtn.addEventListener('click', () => {
    if (monitoringActive) {
        stopMonitoring();
    } else {
        startMonitoring();
    }
});

// Start monitoring
function startMonitoring() {
    monitoringActive = true;
    monitoringBtn.classList.remove('monitoring-btn-off');
    monitoringBtn.classList.add('monitoring-btn-on');
    resultsSection.style.display = 'block';
    
    // Initial fetch
    updateResults();
    
    // Set up polling every 30 seconds
    monitoringInterval = setInterval(updateResults, 30000);
}

// Stop monitoring
function stopMonitoring() {
    monitoringActive = false;
    monitoringBtn.classList.remove('monitoring-btn-on');
    monitoringBtn.classList.add('monitoring-btn-off');
    resultsSection.style.display = 'none';
    
    // Clear polling interval
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
}

// Update results
async function updateResults() {
    try {
        const response = await fetch(`/api/stop/${selectedDeparture.uuid}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Ошибка ${response.status}`);
        }
        
        const data = await response.json();
        
        displayResults(data);
        
    } catch (error) {
        showError('Ошибка при обновлении данных: ' + error.message);
    }
}

// Display results
function displayResults(data) {
    resultsContainer.innerHTML = '';
    
    if (!data.routePath || data.routePath.length === 0) {
        resultsContainer.innerHTML = '<div class="no-arrivals">Нет данных о прибытии</div>';
        return;
    }
    
    // Group routes by number
    const tramsByNumber = {};
    
    data.routePath.forEach(route => {
        if (!selectedTrams.has(route.number)) {
            return; // Skip unselected trams
        }
        
        // Filter by destination if selected
        if (selectedDestination) {
            // Check if this route is going in the right direction
            // This is a simple heuristic - in real app might need more sophisticated logic
            const isCorrectDirection = shouldIncludeRoute(route);
            if (!isCorrectDirection) {
                return;
            }
        }
        
        if (!tramsByNumber[route.number]) {
            tramsByNumber[route.number] = [];
        }
        
        if (route.externalForecast) {
            tramsByNumber[route.number].push(...route.externalForecast);
        }
    });
    
    // Sort tram numbers for consistent display
    const sortedTramNumbers = Object.keys(tramsByNumber).sort((a, b) => {
        const aNum = parseInt(a);
        const bNum = parseInt(b);
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
        }
        return a.localeCompare(b, 'ru');
    });
    
    sortedTramNumbers.forEach(tramNumber => {
        const forecasts = tramsByNumber[tramNumber];
        
        // Sort by time and take first 6
        forecasts.sort((a, b) => a.time - b.time);
        const displayForecasts = forecasts.slice(0, 6);
        
        const resultDiv = document.createElement('div');
        resultDiv.className = 'tram-result';
        
        const numberDiv = document.createElement('div');
        numberDiv.className = 'tram-number';
        numberDiv.textContent = tramNumber;
        
        const timesDiv = document.createElement('div');
        timesDiv.className = 'tram-times';
        
        if (displayForecasts.length === 0) {
            const noData = document.createElement('span');
            noData.className = 'no-arrivals';
            noData.textContent = 'Нет данных';
            timesDiv.appendChild(noData);
        } else {
            displayForecasts.forEach(forecast => {
                const minutes = Math.round(forecast.time / 60);
                const badge = document.createElement('span');
                badge.className = forecast.byTelemetry ? 'time-badge time-telemetry' : 'time-badge time-schedule';
                badge.textContent = `${minutes} мин`;
                timesDiv.appendChild(badge);
            });
        }
        
        resultDiv.appendChild(numberDiv);
        resultDiv.appendChild(timesDiv);
        resultsContainer.appendChild(resultDiv);
    });
    
    if (sortedTramNumbers.length === 0) {
        resultsContainer.innerHTML = '<div class="no-arrivals">Нет данных для выбранных трамваев</div>';
    }
}

// Determine if a route should be included based on destination filtering
function shouldIncludeRoute(route) {
    if (!selectedDestination) {
        return true; // No filtering
    }
    
    // Simple heuristic: check if lastStopName matches destination name
    // In a real app, this would need more sophisticated routing logic
    const destinationName = selectedDestination.name;
    const routeDestination = route.lastStopName;
    
    // Check if route is going towards the destination
    // This is simplified - real implementation would need full route data
    return routeDestination.includes(destinationName) || 
           destinationName.includes(routeDestination);
}

// Show/hide error message
function showError(message, show = true) {
    if (show && message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    } else {
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';
    }
}

// Initialize on page load
init();
