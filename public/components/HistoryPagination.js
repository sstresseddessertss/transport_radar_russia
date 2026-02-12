/**
 * HistoryPagination Component
 * Reusable component for paginating history items
 */

class HistoryPagination {
    /**
     * Creates a new HistoryPagination instance
     * @param {Object} options - Configuration options
     * @param {number} options.currentPage - Current page number (1-indexed)
     * @param {number} options.totalPages - Total number of pages
     * @param {number} options.itemsPerPage - Items per page
     * @param {number} options.totalItems - Total number of items
     * @param {Function} options.onPageChange - Callback when page changes
     */
    constructor(options = {}) {
        this.options = {
            currentPage: 1,
            totalPages: 1,
            itemsPerPage: 10,
            totalItems: 0,
            onPageChange: null,
            ...options
        };
        this.element = null;
    }

    /**
     * Renders the pagination element
     * @returns {HTMLElement} The rendered pagination
     */
    render() {
        const container = document.createElement('div');
        container.className = 'history-pagination';
        container.setAttribute('role', 'navigation');
        container.setAttribute('aria-label', 'Навигация по истории');
        
        // Info text
        const info = document.createElement('div');
        info.className = 'pagination-info';
        const start = (this.options.currentPage - 1) * this.options.itemsPerPage + 1;
        const end = Math.min(this.options.currentPage * this.options.itemsPerPage, this.options.totalItems);
        info.textContent = `${start}-${end} из ${this.options.totalItems}`;
        info.setAttribute('aria-live', 'polite');
        
        // Buttons container
        const buttons = document.createElement('div');
        buttons.className = 'pagination-buttons';
        
        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.textContent = '‹ Назад';
        prevBtn.disabled = this.options.currentPage === 1;
        prevBtn.setAttribute('aria-label', 'Предыдущая страница');
        prevBtn.addEventListener('click', () => this.goToPage(this.options.currentPage - 1));
        
        // Add previous button first
        buttons.appendChild(prevBtn);
        
        // Page numbers
        const pages = this.getPageNumbers();
        pages.forEach(page => {
            if (page === '...') {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                ellipsis.setAttribute('aria-hidden', 'true');
                buttons.appendChild(ellipsis);
            } else {
                const pageBtn = document.createElement('button');
                pageBtn.className = 'pagination-btn pagination-page';
                if (page === this.options.currentPage) {
                    pageBtn.classList.add('active');
                    pageBtn.setAttribute('aria-current', 'page');
                }
                pageBtn.textContent = page;
                pageBtn.setAttribute('aria-label', `Страница ${page}`);
                pageBtn.addEventListener('click', () => this.goToPage(page));
                buttons.appendChild(pageBtn);
            }
        });
        
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.textContent = 'Вперёд ›';
        nextBtn.disabled = this.options.currentPage === this.options.totalPages;
        nextBtn.setAttribute('aria-label', 'Следующая страница');
        nextBtn.addEventListener('click', () => this.goToPage(this.options.currentPage + 1));
        
        buttons.appendChild(nextBtn);
        
        container.appendChild(info);
        container.appendChild(buttons);
        
        this.element = container;
        return container;
    }

    /**
     * Gets page numbers to display
     * @returns {Array} Array of page numbers and ellipsis
     */
    getPageNumbers() {
        const { currentPage, totalPages } = this.options;
        const pages = [];
        
        if (totalPages <= 7) {
            // Show all pages
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Show first, last, current and 2 neighbors
            pages.push(1);
            
            if (currentPage > 3) {
                pages.push('...');
            }
            
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            
            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
            
            if (currentPage < totalPages - 2) {
                pages.push('...');
            }
            
            pages.push(totalPages);
        }
        
        return pages;
    }

    /**
     * Goes to a specific page
     * @param {number} page - Page number to go to
     */
    goToPage(page) {
        if (page < 1 || page > this.options.totalPages || page === this.options.currentPage) {
            return;
        }
        
        this.options.currentPage = page;
        
        if (this.options.onPageChange) {
            this.options.onPageChange(page);
        }
        
        // Re-render
        if (this.element && this.element.parentNode) {
            const newElement = this.render();
            this.element.parentNode.replaceChild(newElement, this.element);
        }
    }

    /**
     * Updates the pagination options
     * @param {Object} options - New options to merge
     */
    update(options) {
        this.options = { ...this.options, ...options };
        if (this.element && this.element.parentNode) {
            const newElement = this.render();
            this.element.parentNode.replaceChild(newElement, this.element);
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
    module.exports = HistoryPagination;
}
