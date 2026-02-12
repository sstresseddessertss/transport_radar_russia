// State
let stops = [];
let selectedDeparture = null;
let availableTrams = [];
let selectedTrams = new Set();
let monitoringActive = false;
let monitoringInterval = null;
let fetchFailureCount = 0;
const MAX_FETCH_FAILURES = 3;
let expandedTrams = new Set(); // Track which tram blocks are expanded
let arrivalHistory = {}; // Store arrival history for current stop

// Service Worker and Push subscription state
let swRegistration = null;
let pushSubscription = null;
let vapidPublicKey = null;

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
const notificationBtn = document.getElementById('notification-btn');
const notificationSetup = document.getElementById('notification-setup');
const notifyTimeSelect = document.getElementById('notify-time');
const notifyTramSelect = document.getElementById('notify-tram');
const confirmNotificationBtn = document.getElementById('confirm-notification-btn');
const cancelNotificationBtn = document.getElementById('cancel-notification-btn');
const activeNotificationsDiv = document.getElementById('active-notifications');
const notificationsList = document.getElementById('notifications-list');

// Notification state
let activeNotifications = [];
let notifiedTrams = new Set(); // Track which trams have been notified to avoid spam
let isPushSubscribed = false;

// Register Service Worker and initialize push
async function registerServiceWorker() {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      swRegistration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registered:', swRegistration);
      
      // Get VAPID public key
      const response = await fetch('/api/push/vapid-public-key');
      const data = await response.json();
      vapidPublicKey = data.publicKey;
      
      // Check if already subscribed
      pushSubscription = await swRegistration.pushManager.getSubscription();
      isPushSubscribed = pushSubscription !== null;
      
      console.log('Push subscription status:', isPushSubscribed);
      
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  } else {
    console.warn('Push notifications not supported in this browser');
  }
}

// Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Subscribe to push notifications
async function subscribeToPush(notifyMinutes, tramNumbers) {
  try {
    if (!swRegistration) {
      throw new Error('Service Worker не зарегистрирован');
    }
    
    if (!vapidPublicKey) {
      throw new Error('VAPID ключ не получен');
    }
    
    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Разрешение на уведомления не предоставлено');
    }
    
    // Subscribe to push
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    pushSubscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });
    
    isPushSubscribed = true;
    
    // Send subscription to server
    const response = await fetch(`/api/stops/${selectedDeparture.uuid}/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscription: pushSubscription.toJSON(),
        notify_minutes: notifyMinutes,
        tram_numbers: tramNumbers
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Ошибка подписки');
    }
    
    return true;
    
  } catch (error) {
    console.error('Push subscription error:', error);
    throw error;
  }
}

// Unsubscribe from push notifications
async function unsubscribeFromPush() {
  try {
    if (pushSubscription) {
      const endpoint = pushSubscription.endpoint;
      
      // Unsubscribe on server
      await fetch(`/api/stops/${selectedDeparture.uuid}/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ endpoint })
      });
      
      // Unsubscribe locally
      await pushSubscription.unsubscribe();
      pushSubscription = null;
      isPushSubscribed = false;
    }
    
    return true;
    
  } catch (error) {
    console.error('Unsubscribe error:', error);
    throw error;
  }
}

// Initialize
async function init() {
    // Register Service Worker first
    await registerServiceWorker();
    
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
    
    // Also populate notification tram selector
    populateNotificationTramSelect();
}

// Populate notification tram select
function populateNotificationTramSelect() {
    notifyTramSelect.innerHTML = '<option value="">Выберите...</option>';
    
    availableTrams.forEach(tramNumber => {
        const option = document.createElement('option');
        option.value = tramNumber;
        option.textContent = tramNumber;
        notifyTramSelect.appendChild(option);
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
    
    // Show notification button if at least one tram is selected
    if (selectedTrams.size > 0) {
        notificationBtn.style.display = 'block';
    } else {
        notificationBtn.style.display = 'none';
    }
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
    
    // Clear expanded state
    expandedTrams.clear();
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
        
        // Track trams for arrival detection
        await trackTrams(data);
        
        // Get latest history
        await fetchHistory();
        
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

// Track trams for arrival history
async function trackTrams(data) {
    try {
        await fetch(`/api/track/${selectedDeparture.uuid}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ routePath: data.routePath || [] })
        });
    } catch (error) {
        // Silent fail - tracking is not critical
        console.warn('Tracking error:', error);
    }
}

// Fetch arrival history
async function fetchHistory() {
    try {
        const response = await fetch(`/api/history/${selectedDeparture.uuid}`);
        if (response.ok) {
            arrivalHistory = await response.json();
        }
    } catch (error) {
        // Silent fail
        console.warn('History fetch error:', error);
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
        
        // Check if this tram is expanded
        const isExpanded = expandedTrams.has(tramNumber);
        if (isExpanded) {
            resultDiv.classList.add('expanded');
        }
        
        // Main content
        const mainContent = document.createElement('div');
        mainContent.className = 'tram-main-content';
        
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
        
        mainContent.appendChild(numberDiv);
        mainContent.appendChild(timesDiv);
        
        // History section (accordion content)
        const history = arrivalHistory[tramNumber];
        if (history && history.length > 0) {
            const historyDiv = document.createElement('div');
            historyDiv.className = 'tram-history';
            historyDiv.style.display = isExpanded ? 'block' : 'none';
            
            const historyTitle = document.createElement('div');
            historyTitle.className = 'history-title';
            historyTitle.textContent = 'Последние прибытия:';
            historyDiv.appendChild(historyTitle);
            
            const historyList = document.createElement('div');
            historyList.className = 'history-list';
            
            history.forEach(item => {
                const historyItem = document.createElement('span');
                historyItem.className = 'history-item';
                historyItem.textContent = item.displayTime;
                historyList.appendChild(historyItem);
            });
            
            historyDiv.appendChild(historyList);
            
            // Add click handler to toggle accordion
            mainContent.style.cursor = 'pointer';
            mainContent.addEventListener('click', () => {
                if (expandedTrams.has(tramNumber)) {
                    expandedTrams.delete(tramNumber);
                    resultDiv.classList.remove('expanded');
                    historyDiv.style.display = 'none';
                } else {
                    expandedTrams.add(tramNumber);
                    resultDiv.classList.add('expanded');
                    historyDiv.style.display = 'block';
                }
            });
            
            resultDiv.appendChild(mainContent);
            resultDiv.appendChild(historyDiv);
        } else {
            // No history, just add main content
            resultDiv.appendChild(mainContent);
        }
        
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

// Show message (info/success/error)
function showMessage(message, type = 'info') {
    if (!message) {
        errorMessage.style.display = 'none';
        errorMessage.className = 'error-message';
        return;
    }
    
    errorMessage.textContent = message;
    errorMessage.className = type === 'success' ? 'success-message' : 'error-message';
    errorMessage.style.display = 'block';
}

// Notification button click
notificationBtn.addEventListener('click', async () => {
    // Check if push notifications are supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        showMessage('Ваш браузер не поддерживает push-уведомления', 'error');
        return;
    }
    
    // Request permission if not already granted
    if ('Notification' in window) {
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                showMessage('Разрешение на уведомления не предоставлено', 'error');
                return;
            }
        } else if (Notification.permission === 'denied') {
            showMessage('Уведомления заблокированы. Разрешите уведомления в настройках браузера.', 'error');
            return;
        }
    } else {
        showMessage('Ваш браузер не поддерживает уведомления', 'error');
        return;
    }
    
    // Show notification setup
    notificationSetup.style.display = 'block';
    notificationSetup.scrollIntoView({ behavior: 'smooth' });
});

// Cancel notification setup
cancelNotificationBtn.addEventListener('click', () => {
    notificationSetup.style.display = 'none';
});

// Confirm notification
confirmNotificationBtn.addEventListener('click', async () => {
    const minutes = parseInt(notifyTimeSelect.value);
    const tramNumber = notifyTramSelect.value;
    
    if (!tramNumber) {
        showMessage('Выберите трамвай', 'error');
        return;
    }
    
    // Check if notification for this tram already exists
    if (activeNotifications.some(n => n.tramNumber === tramNumber)) {
        showMessage('Уведомление для этого трамвая уже активно', 'error');
        return;
    }
    
    // Disable button while subscribing
    confirmNotificationBtn.disabled = true;
    confirmNotificationBtn.textContent = 'Подключение...';
    
    try {
        // Add to active notifications first
        const notification = {
            id: Date.now(),
            tramNumber,
            minutes,
            stopName: selectedDeparture.name
        };
        
        activeNotifications.push(notification);
        
        // Collect all tram numbers and use the minimum notify time
        const allTramNumbers = activeNotifications.map(n => n.tramNumber);
        const minNotifyMinutes = Math.min(...activeNotifications.map(n => n.minutes));
        
        // Subscribe to push notifications with all selected trams
        await subscribeToPush(minNotifyMinutes, allTramNumbers);
        
        // Update display
        updateActiveNotificationsDisplay();
        
        // Hide setup form
        notificationSetup.style.display = 'none';
        
        // Show success message
        showMessage(`✓ Push-уведомления настроены для трамвая ${tramNumber}`, 'success');
        setTimeout(() => showMessage(''), 3000);
        
    } catch (error) {
        // Remove the notification we just added if subscription failed
        activeNotifications = activeNotifications.filter(n => n.tramNumber !== tramNumber);
        showMessage(`Ошибка подписки: ${error.message}`, 'error');
    } finally {
        confirmNotificationBtn.disabled = false;
        confirmNotificationBtn.textContent = 'Включить';
    }
});

// Update active notifications display
function updateActiveNotificationsDisplay() {
    if (activeNotifications.length === 0) {
        activeNotificationsDiv.style.display = 'none';
        return;
    }
    
    activeNotificationsDiv.style.display = 'block';
    notificationsList.innerHTML = '';
    
    activeNotifications.forEach(notif => {
        const div = document.createElement('div');
        div.className = 'notification-item';
        
        const info = document.createElement('div');
        info.className = 'notification-info';
        info.innerHTML = `<strong>Трамвай ${notif.tramNumber}</strong><br>Оповестить за ${notif.minutes} мин`;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-notification-btn';
        removeBtn.textContent = 'Удалить';
        removeBtn.addEventListener('click', () => removeNotification(notif.id));
        
        div.appendChild(info);
        div.appendChild(removeBtn);
        notificationsList.appendChild(div);
    });
}

// Remove notification
async function removeNotification(id) {
    activeNotifications = activeNotifications.filter(n => n.id !== id);
    
    if (activeNotifications.length === 0) {
        // No more notifications - unsubscribe completely
        if (isPushSubscribed) {
            try {
                await unsubscribeFromPush();
            } catch (error) {
                console.error('Error unsubscribing:', error);
            }
        }
    } else {
        // Still have notifications - update subscription with remaining trams
        try {
            const allTramNumbers = activeNotifications.map(n => n.tramNumber);
            const minNotifyMinutes = Math.min(...activeNotifications.map(n => n.minutes));
            await subscribeToPush(minNotifyMinutes, allTramNumbers);
        } catch (error) {
            console.error('Error updating subscription:', error);
        }
    }
    
    updateActiveNotificationsDisplay();
}

// Initialize on page load
init();
