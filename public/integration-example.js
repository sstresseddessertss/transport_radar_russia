/**
 * Integration Example: Using SearchableStopDropdown in the main app
 * 
 * This file demonstrates how to replace the standard dropdown
 * with the SearchableStopDropdown component.
 */

// Example 1: Replace the departure stop dropdown
// In your HTML, replace:
// <select id="departure-stop" class="stop-select">...</select>
// With:
// <div id="departure-stop-container"></div>

// Then in your JavaScript:
/*
const departureDropdown = new SearchableStopDropdown({
    containerId: 'departure-stop-container',
    value: selectedDeparture ? selectedDeparture.uuid : '',
    onChange: async function(stop) {
        selectedDeparture = stop;
        
        // Fetch available trams for this stop
        await fetchAvailableTrams();
    },
    placeholder: 'Search for departure stop...',
    debounceMs: 300,
    pageSize: 20
});
*/

// Example 2: Using with custom filtering
/*
const customDropdown = new SearchableStopDropdown({
    containerId: 'my-container',
    onChange: function(stop) {
        console.log('Selected:', stop);
        
        // Custom logic after selection
        if (stop.direction === 'в центр') {
            // Handle center-bound stops differently
        }
    },
    placeholder: 'Type to search...',
    debounceMs: 500,  // Longer debounce for slower connections
    pageSize: 10      // Fewer results per page
});
*/

// Example 3: Programmatically destroying the component
/*
// When you no longer need the dropdown (e.g., navigating away)
if (departureDropdown) {
    departureDropdown.destroy();
}
*/

// Example 4: Updating the selected value programmatically
/*
// The component doesn't expose a setValue method by design,
// but you can work around it by recreating the component
// or by manually setting the input value (not recommended)

// Better approach: Store the reference and recreate if needed
let currentDropdown = new SearchableStopDropdown({
    containerId: 'container',
    value: initialValue,
    onChange: handleChange
});

function resetDropdown(newValue) {
    if (currentDropdown) {
        currentDropdown.destroy();
    }
    
    currentDropdown = new SearchableStopDropdown({
        containerId: 'container',
        value: newValue,
        onChange: handleChange
    });
}
*/

// Full integration example for index.html
/*
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Transport Radar Russia</title>
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="SearchableStopDropdown.css">
</head>
<body>
    <div class="container">
        <main>
            <div class="form-section">
                <!-- Replace the select with a container -->
                <div class="form-group">
                    <label for="departure-stop-container">Остановка отправления:</label>
                    <div id="departure-stop-container"></div>
                </div>

                <!-- Rest of your form... -->
            </div>
        </main>
    </div>

    <script src="SearchableStopDropdown.js"></script>
    <script src="app.js"></script>
    <script>
        // After DOM is loaded, initialize the searchable dropdown
        document.addEventListener('DOMContentLoaded', function() {
            const departureDropdown = new SearchableStopDropdown({
                containerId: 'departure-stop-container',
                onChange: function(stop) {
                    selectedDeparture = stop;
                    fetchAvailableTrams();
                },
                placeholder: 'Поиск остановки...'
            });
        });
    </script>
</body>
</html>
*/

// Backend endpoint is already implemented in server.js
// No additional backend changes needed!
