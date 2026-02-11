// SearchableDropdown Component
class SearchableDropdown {
    constructor(containerId, placeholder, onSelect) {
        this.container = document.getElementById(containerId);
        this.placeholder = placeholder;
        this.onSelect = onSelect;
        this.items = [];
        this.selectedItem = null;
        this.isOpen = false;
        this.highlightedIndex = -1;
        
        this.render();
        this.attachEventListeners();
    }
    
    render() {
        this.container.innerHTML = `
            <div class="searchable-dropdown">
                <input 
                    type="text" 
                    class="searchable-dropdown-input" 
                    placeholder="${this.placeholder}"
                    readonly
                />
                <div class="searchable-dropdown-list searchable-dropdown-hidden"></div>
            </div>
        `;
        
        this.input = this.container.querySelector('.searchable-dropdown-input');
        this.list = this.container.querySelector('.searchable-dropdown-list');
    }
    
    attachEventListeners() {
        // Click on input to toggle dropdown
        this.input.addEventListener('click', () => {
            if (!this.isOpen) {
                this.open();
            }
        });
        
        // Input changes for search
        this.input.addEventListener('input', () => {
            this.filterItems();
        });
        
        // Keyboard navigation
        this.input.addEventListener('keydown', (e) => {
            if (!this.isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
                this.open();
                e.preventDefault();
                return;
            }
            
            if (this.isOpen) {
                switch (e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        this.highlightNext();
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        this.highlightPrevious();
                        break;
                    case 'Enter':
                        e.preventDefault();
                        if (this.highlightedIndex >= 0) {
                            const filteredItems = this.getFilteredItems();
                            if (filteredItems[this.highlightedIndex]) {
                                this.selectItem(filteredItems[this.highlightedIndex]);
                            }
                        }
                        break;
                    case 'Escape':
                        e.preventDefault();
                        this.close();
                        break;
                }
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.close();
            }
        });
    }
    
    setItems(items) {
        this.items = items;
        this.filterItems();
    }
    
    getFilteredItems() {
        const searchTerm = this.input.value.toLowerCase();
        if (!searchTerm) {
            return this.items;
        }
        
        return this.items.filter(item => 
            item.label.toLowerCase().includes(searchTerm)
        );
    }
    
    filterItems() {
        const filteredItems = this.getFilteredItems();
        this.renderList(filteredItems);
        this.highlightedIndex = -1;
    }
    
    renderList(items) {
        if (items.length === 0) {
            this.list.innerHTML = '<div class="searchable-dropdown-empty">Ничего не найдено</div>';
            return;
        }
        
        this.list.innerHTML = '';
        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'searchable-dropdown-item';
            div.textContent = item.label;
            div.dataset.index = index;
            
            if (this.selectedItem && this.selectedItem.value === item.value) {
                div.classList.add('selected');
            }
            
            div.addEventListener('click', () => {
                this.selectItem(item);
            });
            
            this.list.appendChild(div);
        });
    }
    
    highlightNext() {
        const filteredItems = this.getFilteredItems();
        if (filteredItems.length === 0) return;
        
        this.highlightedIndex = (this.highlightedIndex + 1) % filteredItems.length;
        this.updateHighlight();
    }
    
    highlightPrevious() {
        const filteredItems = this.getFilteredItems();
        if (filteredItems.length === 0) return;
        
        this.highlightedIndex = this.highlightedIndex <= 0 
            ? filteredItems.length - 1 
            : this.highlightedIndex - 1;
        this.updateHighlight();
    }
    
    updateHighlight() {
        const items = this.list.querySelectorAll('.searchable-dropdown-item');
        items.forEach((item, index) => {
            if (index === this.highlightedIndex) {
                item.classList.add('highlighted');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('highlighted');
            }
        });
    }
    
    selectItem(item) {
        this.selectedItem = item;
        this.input.value = item.label;
        this.close();
        
        if (this.onSelect) {
            this.onSelect(item.value, item);
        }
    }
    
    open() {
        this.isOpen = true;
        this.input.removeAttribute('readonly');
        this.input.focus();
        this.input.select();
        this.list.classList.remove('searchable-dropdown-hidden');
        this.filterItems();
    }
    
    close() {
        this.isOpen = false;
        this.input.setAttribute('readonly', 'true');
        this.list.classList.add('searchable-dropdown-hidden');
        this.highlightedIndex = -1;
        
        // Restore selected item label if it exists
        if (this.selectedItem) {
            this.input.value = this.selectedItem.label;
        } else {
            this.input.value = '';
        }
    }
    
    reset() {
        this.selectedItem = null;
        this.input.value = '';
        this.close();
    }
    
    getValue() {
        return this.selectedItem ? this.selectedItem.value : null;
    }
}

// State
let stops = [];
let selectedDeparture = null;
let selectedDestination = null;
let availableTrams = [];
let selectedTrams = new Set();
let monitoringActive = false;
let monitoringInterval = null;

// SearchableDropdown instances
let departureDropdown = null;
let destinationDropdown = null;

// DOM elements
const tramSelectionGroup = document.getElementById('tram-selection-group');
const tramCheckboxesContainer = document.getElementById('tram-checkboxes');
const monitoringBtn = document.getElementById('monitoring-btn');
const resultsSection = document.getElementById('results-section');
const resultsContainer = document.getElementById('results');
const errorMessage = document.getElementById('error-message');

// Add stop form elements
const addStopBtn = document.getElementById('add-stop-btn');
const addStopForm = document.getElementById('add-stop-form');
const addStopNotification = document.getElementById('add-stop-notification');
const stopUuidInput = document.getElementById('stop-uuid');
const stopNameInput = document.getElementById('stop-name');
const stopDirectionSelect = document.getElementById('stop-direction');
const saveStopBtn = document.getElementById('save-stop-btn');
const cancelStopBtn = document.getElementById('cancel-stop-btn');

// Initialize
async function init() {
    try {
        await loadStops();
        initializeDropdowns();
        initializeAddStopForm();
    } catch (error) {
        showError('Ошибка при загрузке данных: ' + error.message);
    }
}

// Load stops from API
async function loadStops() {
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
}

// Initialize searchable dropdowns
function initializeDropdowns() {
    // Departure dropdown
    departureDropdown = new SearchableDropdown(
        'departure-stop-container',
        'Выберите остановку...',
        async (uuid, item) => {
            selectedDeparture = stops.find(s => s.uuid === uuid);
            if (selectedDeparture) {
                await fetchAvailableTrams();
            }
        }
    );
    
    // Destination dropdown
    destinationDropdown = new SearchableDropdown(
        'destination-stop-container',
        'Выберите остановку...',
        (uuid) => {
            selectedDestination = uuid ? stops.find(s => s.uuid === uuid) : null;
            
            // If monitoring is active, update results with new filtering
            if (monitoringActive) {
                updateResults();
            }
        }
    );
    
    // Populate both dropdowns
    updateDropdowns();
}

// Update dropdowns with current stops
function updateDropdowns() {
    const items = stops.map(stop => ({
        value: stop.uuid,
        label: `${stop.name} (${stop.direction})`,
        data: stop
    }));
    
    departureDropdown.setItems(items);
    destinationDropdown.setItems(items);
}

// Initialize add stop form
function initializeAddStopForm() {
    addStopBtn.addEventListener('click', () => {
        addStopForm.style.display = 'block';
        addStopBtn.style.display = 'none';
        hideNotification();
    });
    
    cancelStopBtn.addEventListener('click', () => {
        resetAddStopForm();
    });
    
    saveStopBtn.addEventListener('click', async () => {
        await saveNewStop();
    });
    
    // Real-time UUID validation
    stopUuidInput.addEventListener('input', () => {
        validateUuidFormat();
    });
}

// Validate UUID format (8-4-4-4-12)
function validateUuidFormat() {
    const uuid = stopUuidInput.value.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuid) {
        stopUuidInput.style.borderColor = '';
        return false;
    }
    
    const isValid = uuidRegex.test(uuid);
    stopUuidInput.style.borderColor = isValid ? 'var(--accent-green)' : 'var(--error-color)';
    return isValid;
}

// Save new stop
async function saveNewStop() {
    const uuid = stopUuidInput.value.trim();
    const name = stopNameInput.value.trim();
    const direction = stopDirectionSelect.value;
    
    // Validate inputs
    if (!uuid || !name || !direction) {
        showNotification('Пожалуйста, заполните все поля', 'error');
        return;
    }
    
    if (!validateUuidFormat()) {
        showNotification('Неверный формат UUID. Формат: 8-4-4-4-12 hex символов', 'error');
        return;
    }
    
    // Check for duplicates
    const exists = stops.find(s => s.uuid.toLowerCase() === uuid.toLowerCase());
    if (exists) {
        showNotification('Остановка с таким UUID уже существует', 'error');
        return;
    }
    
    // Disable save button during request
    saveStopBtn.disabled = true;
    saveStopBtn.textContent = 'Сохранение...';
    
    try {
        const response = await fetch('/api/stops', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uuid, name, direction })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ошибка при сохранении остановки');
        }
        
        const result = await response.json();
        
        // Add new stop to local array
        stops.push(result.stop);
        
        // Re-sort stops
        stops.sort((a, b) => {
            const aLabel = `${a.name} (${a.direction})`;
            const bLabel = `${b.name} (${b.direction})`;
            return aLabel.localeCompare(bLabel, 'ru');
        });
        
        // Update dropdowns
        updateDropdowns();
        
        // Show success message
        showNotification('Остановка успешно добавлена!', 'success');
        
        // Reset form after short delay
        setTimeout(() => {
            resetAddStopForm();
        }, 2000);
        
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        saveStopBtn.disabled = false;
        saveStopBtn.textContent = 'Сохранить';
    }
}

// Show notification
function showNotification(message, type) {
    addStopNotification.textContent = message;
    addStopNotification.className = `notification notification-${type}`;
}

// Hide notification
function hideNotification() {
    addStopNotification.className = 'notification notification-hidden';
}

// Reset add stop form
function resetAddStopForm() {
    addStopForm.style.display = 'none';
    addStopBtn.style.display = 'block';
    stopUuidInput.value = '';
    stopNameInput.value = '';
    stopDirectionSelect.value = '';
    stopUuidInput.style.borderColor = '';
    hideNotification();
}

// Populate stop dropdowns (deprecated - using SearchableDropdown now)
function populateStopSelects() {
    // This function is no longer needed
}

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
