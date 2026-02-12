/**
 * ArrivalList Component
 * Reusable component for displaying tram arrival information
 */

class ArrivalList {
    /**
     * Creates a new ArrivalList instance
     * @param {Array} arrivals - Array of arrival data
     * @param {Object} options - Configuration options
     * @param {boolean} options.showHistory - Whether to show arrival history
     * @param {Function} options.onExpand - Callback when item is expanded
     */
    constructor(arrivals = [], options = {}) {
        this.arrivals = arrivals;
        this.options = {
            showHistory: false,
            onExpand: null,
            ...options
        };
        this.element = null;
        this.expandedItems = new Set();
    }

    /**
     * Renders the arrival list element
     * @returns {HTMLElement} The rendered arrival list
     */
    render() {
        const container = document.createElement('div');
        container.className = 'arrival-list';
        container.setAttribute('role', 'list');
        
        if (this.arrivals.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'no-arrivals';
            emptyMessage.textContent = 'Нет данных о прибытии';
            container.appendChild(emptyMessage);
        } else {
            this.arrivals.forEach(arrival => {
                const item = this.renderArrivalItem(arrival);
                container.appendChild(item);
            });
        }
        
        this.element = container;
        return container;
    }

    /**
     * Renders a single arrival item
     * @param {Object} arrival - Arrival data
     * @returns {HTMLElement} The rendered item
     */
    renderArrivalItem(arrival) {
        const item = document.createElement('div');
        item.className = 'arrival-item';
        item.setAttribute('role', 'listitem');
        
        const mainContent = document.createElement('div');
        mainContent.className = 'arrival-main-content';
        
        const tramNumber = document.createElement('div');
        tramNumber.className = 'arrival-tram-number';
        tramNumber.textContent = arrival.tramNumber;
        
        const times = document.createElement('div');
        times.className = 'arrival-times';
        
        if (arrival.forecasts && arrival.forecasts.length > 0) {
            arrival.forecasts.forEach(forecast => {
                const badge = document.createElement('span');
                badge.className = forecast.byTelemetry ? 'time-badge time-telemetry' : 'time-badge time-schedule';
                badge.textContent = `${forecast.minutes} мин`;
                badge.setAttribute('aria-label', `${forecast.minutes} минут, ${forecast.byTelemetry ? 'GPS данные' : 'по расписанию'}`);
                times.appendChild(badge);
            });
        } else {
            const noData = document.createElement('span');
            noData.className = 'no-arrivals';
            noData.textContent = 'Нет данных';
            times.appendChild(noData);
        }
        
        mainContent.appendChild(tramNumber);
        mainContent.appendChild(times);
        item.appendChild(mainContent);
        
        // Add history if available and enabled
        if (this.options.showHistory && arrival.history && arrival.history.length > 0) {
            const isExpanded = this.expandedItems.has(arrival.tramNumber);
            
            const historyDiv = document.createElement('div');
            historyDiv.className = 'arrival-history';
            historyDiv.style.display = isExpanded ? 'block' : 'none';
            
            const historyTitle = document.createElement('div');
            historyTitle.className = 'history-title';
            historyTitle.textContent = 'Последние прибытия:';
            historyDiv.appendChild(historyTitle);
            
            const historyList = document.createElement('div');
            historyList.className = 'history-list';
            
            arrival.history.forEach(histItem => {
                const histSpan = document.createElement('span');
                histSpan.className = 'history-item';
                histSpan.textContent = histItem.displayTime;
                historyList.appendChild(histSpan);
            });
            
            historyDiv.appendChild(historyList);
            item.appendChild(historyDiv);
            
            // Make clickable to toggle
            mainContent.style.cursor = 'pointer';
            mainContent.setAttribute('tabindex', '0');
            mainContent.setAttribute('role', 'button');
            mainContent.setAttribute('aria-expanded', isExpanded.toString());
            mainContent.setAttribute('aria-label', `Трамвай ${arrival.tramNumber}, показать историю прибытий`);
            
            const toggleHistory = () => {
                const newState = !this.expandedItems.has(arrival.tramNumber);
                if (newState) {
                    this.expandedItems.add(arrival.tramNumber);
                    historyDiv.style.display = 'block';
                    mainContent.setAttribute('aria-expanded', 'true');
                } else {
                    this.expandedItems.delete(arrival.tramNumber);
                    historyDiv.style.display = 'none';
                    mainContent.setAttribute('aria-expanded', 'false');
                }
                
                if (this.options.onExpand) {
                    this.options.onExpand(arrival.tramNumber, newState);
                }
            };
            
            mainContent.addEventListener('click', toggleHistory);
            mainContent.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleHistory();
                }
            });
        }
        
        return item;
    }

    /**
     * Updates the arrival data
     * @param {Array} arrivals - New arrival data
     */
    update(arrivals) {
        this.arrivals = arrivals;
        if (this.element) {
            // Re-render
            const newElement = this.render();
            if (this.element.parentNode) {
                this.element.parentNode.replaceChild(newElement, this.element);
            }
        }
    }

    /**
     * Destroys the component
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.expandedItems.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArrivalList;
}
