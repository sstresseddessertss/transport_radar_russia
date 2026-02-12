/**
 * StopCard Component
 * Reusable component for displaying stop information
 */

class StopCard {
    /**
     * Creates a new StopCard instance
     * @param {Object} stop - Stop data
     * @param {string} stop.uuid - Stop unique identifier
     * @param {string} stop.name - Stop name
     * @param {string} stop.direction - Stop direction
     * @param {Function} onSelect - Callback when stop is selected
     */
    constructor(stop, onSelect = null) {
        this.stop = stop;
        this.onSelect = onSelect;
        this.element = null;
    }

    /**
     * Renders the stop card element
     * @returns {HTMLElement} The rendered stop card
     */
    render() {
        const card = document.createElement('div');
        card.className = 'stop-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `Остановка ${this.stop.name} в направлении ${this.stop.direction}`);
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'stop-card-name';
        nameDiv.textContent = this.stop.name;
        
        const directionDiv = document.createElement('div');
        directionDiv.className = 'stop-card-direction';
        directionDiv.textContent = this.stop.direction;
        
        card.appendChild(nameDiv);
        card.appendChild(directionDiv);
        
        // Add click handler
        if (this.onSelect) {
            card.addEventListener('click', () => this.onSelect(this.stop));
            
            // Add keyboard support
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.onSelect(this.stop);
                }
            });
        }
        
        this.element = card;
        return card;
    }

    /**
     * Updates the stop data
     * @param {Object} stop - New stop data
     */
    update(stop) {
        this.stop = stop;
        if (this.element) {
            const nameDiv = this.element.querySelector('.stop-card-name');
            const directionDiv = this.element.querySelector('.stop-card-direction');
            if (nameDiv) nameDiv.textContent = stop.name;
            if (directionDiv) directionDiv.textContent = stop.direction;
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
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StopCard;
}
