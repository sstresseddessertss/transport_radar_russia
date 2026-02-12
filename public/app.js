// State
let stops = [];
let selectedDeparture = null;
let availableTrams = [];
let selectedTrams = new Set();
let monitoringActive = false;
let monitoringInterval = null;
let fetchFailureCount = 0;
const MAX_FETCH_FAILURES = 3;

// DOM elements
const departureSelect = document.getElementById('departure-stop');
const tramSelectionGroup = document.getElementById('tram-selection-group');
const tramCheckboxesContainer = document.getElementById('tram-checkboxes');
const monitoringBtn = document.getElementById('monitoring-btn');
const resultsSection = document.getElementById('results-section');
const resultsContainer = document.getElementById('results');
const errorMessage = document.getElementById('error-message');
const stopUrlInput = document.getElementById('stop-url-input');
const addStopBtn = document.getElementById('add-stop-btn');
const addStopMessage = document.getElementById('add-stop-message');

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
    // Clear existing options except the first one
    departureSelect.innerHTML = '<option value="">Выберите остановку...</option>';
    
    stops.forEach(stop => {
        const label = `${stop.name} (${stop.direction})`;
        
        const departureOption = document.createElement('option');
        departureOption.value = stop.uuid;
        departureOption.textContent = label;
        departureOption.dataset.name = stop.name;
        departureOption.dataset.direction = stop.direction;
        departureSelect.appendChild(departureOption);
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
    
    // Reset failure count when starting monitoring
    fetchFailureCount = 0;
    
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
        
        // Reset failure count on success
        fetchFailureCount = 0;
        
        displayResults(data);
        
    } catch (error) {
        fetchFailureCount++;
        
        // Only show error to user after multiple consecutive failures
        if (fetchFailureCount >= MAX_FETCH_FAILURES) {
            showError('Ошибка при обновлении данных: ' + error.message);
        } else {
            // Silent retry - just log to console
            console.warn(`Fetch attempt ${fetchFailureCount} failed, will retry on next interval:`, error.message);
        }
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

// Add stop by URL
addStopBtn.addEventListener('click', async () => {
    const url = stopUrlInput.value.trim();
    
    if (!url) {
        showAddStopMessage('Введите ссылку на остановку', 'error');
        return;
    }
    
    addStopBtn.disabled = true;
    showAddStopMessage('Добавление...', '');
    
    try {
        const response = await fetch('/api/stops/import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `Ошибка ${response.status}`);
        }
        
        // Add to local stops array
        stops.push(data.stop);
        
        // Sort stops
        stops.sort((a, b) => {
            const aLabel = `${a.name} (${a.direction})`;
            const bLabel = `${b.name} (${b.direction})`;
            return aLabel.localeCompare(bLabel, 'ru');
        });
        
        // Refresh dropdown
        populateStopSelects();
        
        // Clear input
        stopUrlInput.value = '';
        
        // Show success message
        showAddStopMessage(`✓ Остановка "${data.stop.name}" добавлена`, 'success');
        
        // Auto-select the newly added stop
        departureSelect.value = data.stop.uuid;
        departureSelect.dispatchEvent(new Event('change'));
        
    } catch (error) {
        showAddStopMessage(error.message, 'error');
    } finally {
        addStopBtn.disabled = false;
    }
});

// Allow Enter key to add stop
stopUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addStopBtn.click();
    }
});

// Show add stop message
function showAddStopMessage(message, type) {
    if (!message) {
        addStopMessage.style.display = 'none';
        addStopMessage.className = 'add-stop-message';
        return;
    }
    
    addStopMessage.textContent = message;
    addStopMessage.className = `add-stop-message ${type}`;
    addStopMessage.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            addStopMessage.style.display = 'none';
        }, 5000);
    }
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
