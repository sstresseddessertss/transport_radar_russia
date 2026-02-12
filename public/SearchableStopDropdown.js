/**
 * SearchableStopDropdown - A reusable vanilla JavaScript component for searchable dropdown
 * with debouncing, caching, pagination, and accessibility features
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.containerId - ID of the container element
 * @param {string} options.value - Currently selected value (UUID)
 * @param {Function} options.onChange - Callback function when selection changes
 * @param {string} options.placeholder - Placeholder text
 * @param {number} options.debounceMs - Debounce delay in milliseconds (default: 300)
 * @param {number} options.pageSize - Number of results per page (default: 20)
 */
class SearchableStopDropdown {
  constructor(options) {
    this.containerId = options.containerId;
    this.value = options.value || '';
    this.onChange = options.onChange || (() => {});
    this.placeholder = options.placeholder || 'Search stops...';
    this.debounceMs = options.debounceMs || 300;
    this.pageSize = options.pageSize || 20;
    
    // State
    this.isOpen = false;
    this.searchTerm = '';
    this.results = [];
    this.selectedIndex = -1;
    this.currentPage = 1;
    this.totalPages = 1;
    this.hasMore = false;
    this.isLoading = false;
    this.error = null;
    this.abortController = null;
    this.debounceTimeout = null;
    
    // Cache configuration
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    
    // Initialize
    this.render();
    this.attachEventListeners();
  }
  
  /**
   * Render the component HTML
   */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Container with id "${this.containerId}" not found`);
      return;
    }
    
    container.innerHTML = `
      <div class="searchable-dropdown" role="combobox" aria-expanded="false" aria-haspopup="listbox">
        <div class="searchable-dropdown-input-wrapper">
          <input 
            type="text" 
            class="searchable-dropdown-input"
            placeholder="${this.placeholder}"
            autocomplete="off"
            aria-autocomplete="list"
            aria-controls="searchable-dropdown-list"
            role="searchbox"
          />
          <span class="searchable-dropdown-arrow">▼</span>
        </div>
        <div class="searchable-dropdown-list" id="searchable-dropdown-list" role="listbox" style="display: none;">
          <div class="searchable-dropdown-loading" style="display: none;">
            Loading...
          </div>
          <div class="searchable-dropdown-error" style="display: none;"></div>
          <div class="searchable-dropdown-no-results" style="display: none;">
            No results found
          </div>
          <div class="searchable-dropdown-options"></div>
          <div class="searchable-dropdown-load-more" style="display: none;">
            <button class="searchable-dropdown-load-more-btn">Load More</button>
          </div>
        </div>
      </div>
    `;
    
    this.elements = {
      wrapper: container.querySelector('.searchable-dropdown'),
      input: container.querySelector('.searchable-dropdown-input'),
      list: container.querySelector('.searchable-dropdown-list'),
      options: container.querySelector('.searchable-dropdown-options'),
      loading: container.querySelector('.searchable-dropdown-loading'),
      error: container.querySelector('.searchable-dropdown-error'),
      noResults: container.querySelector('.searchable-dropdown-no-results'),
      loadMore: container.querySelector('.searchable-dropdown-load-more'),
      loadMoreBtn: container.querySelector('.searchable-dropdown-load-more-btn')
    };
  }
  
  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Input events
    this.elements.input.addEventListener('input', (e) => {
      this.handleInput(e.target.value);
    });
    
    this.elements.input.addEventListener('focus', () => {
      this.open();
    });
    
    this.elements.input.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });
    
    // Load more button
    this.elements.loadMoreBtn.addEventListener('click', () => {
      this.loadMore();
    });
    
    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!this.elements.wrapper.contains(e.target)) {
        this.close();
      }
    });
  }
  
  /**
   * Handle input changes with debouncing
   */
  handleInput(value) {
    this.searchTerm = value;
    
    // Cancel previous debounce
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    
    // Debounce the search
    this.debounceTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.search();
    }, this.debounceMs);
  }
  
  /**
   * Handle keyboard navigation
   */
  handleKeydown(e) {
    if (!this.isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.open();
      }
      return;
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
        this.updateSelection();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        this.updateSelection();
        break;
        
      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0 && this.results[this.selectedIndex]) {
          this.selectOption(this.results[this.selectedIndex]);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
    }
  }
  
  /**
   * Search for stops
   */
  async search() {
    // Cancel any in-flight request
    if (this.abortController) {
      this.abortController.abort();
    }
    
    // Check cache first
    const cacheKey = `${this.searchTerm}_${this.currentPage}`;
    const cached = this.getCached(cacheKey);
    
    if (cached) {
      this.displayResults(cached);
      return;
    }
    
    // Show loading state
    this.isLoading = true;
    this.error = null;
    this.updateLoadingState();
    
    // Create new abort controller for this request
    this.abortController = new AbortController();
    
    try {
      const params = new URLSearchParams({
        page: this.currentPage,
        page_size: this.pageSize
      });
      
      if (this.searchTerm.trim()) {
        params.append('prefix', this.searchTerm.trim());
      }
      
      const response = await fetch(`/api/stops?${params}`, {
        signal: this.abortController.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle backward compatibility (old API returns { stops: [...] })
      const stops = data.stops || [];
      const meta = data.meta || {
        total: stops.length,
        page: 1,
        page_size: stops.length,
        total_pages: 1,
        has_next: false,
        has_prev: false
      };
      
      // Cache the result
      this.setCached(cacheKey, { stops, meta });
      
      this.displayResults({ stops, meta });
      
    } catch (error) {
      if (error.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      
      this.error = error.message;
      this.isLoading = false;
      this.updateLoadingState();
    }
  }
  
  /**
   * Load more results (next page)
   */
  async loadMore() {
    this.currentPage++;
    await this.search();
  }
  
  /**
   * Display search results
   */
  displayResults(data) {
    this.isLoading = false;
    this.error = null;
    
    const { stops, meta } = data;
    
    if (this.currentPage === 1) {
      this.results = stops;
    } else {
      // Append to existing results for pagination
      this.results = [...this.results, ...stops];
    }
    
    this.totalPages = meta.total_pages;
    this.hasMore = meta.has_next;
    
    this.renderOptions();
    this.updateLoadingState();
  }
  
  /**
   * Render the options list
   */
  renderOptions() {
    this.elements.options.innerHTML = '';
    
    if (this.results.length === 0) {
      return;
    }
    
    this.results.forEach((stop, index) => {
      const option = document.createElement('div');
      option.className = 'searchable-dropdown-option';
      option.setAttribute('role', 'option');
      option.setAttribute('data-uuid', stop.uuid);
      option.textContent = `${stop.name} (${stop.direction})`;
      
      if (index === this.selectedIndex) {
        option.classList.add('selected');
        option.setAttribute('aria-selected', 'true');
      }
      
      option.addEventListener('click', () => {
        this.selectOption(stop);
      });
      
      this.elements.options.appendChild(option);
    });
  }
  
  /**
   * Update visual selection
   */
  updateSelection() {
    const options = this.elements.options.querySelectorAll('.searchable-dropdown-option');
    options.forEach((option, index) => {
      if (index === this.selectedIndex) {
        option.classList.add('selected');
        option.setAttribute('aria-selected', 'true');
        // scrollIntoView may not be available in test environments
        if (typeof option.scrollIntoView === 'function') {
          option.scrollIntoView({ block: 'nearest' });
        }
      } else {
        option.classList.remove('selected');
        option.setAttribute('aria-selected', 'false');
      }
    });
  }
  
  /**
   * Select an option
   */
  selectOption(stop) {
    this.value = stop.uuid;
    this.elements.input.value = `${stop.name} (${stop.direction})`;
    this.close();
    this.onChange(stop);
  }
  
  /**
   * Update loading/error/no-results states
   */
  updateLoadingState() {
    this.elements.loading.style.display = this.isLoading ? 'block' : 'none';
    this.elements.error.style.display = this.error ? 'block' : 'none';
    this.elements.noResults.style.display = 
      !this.isLoading && !this.error && this.results.length === 0 ? 'block' : 'none';
    this.elements.options.style.display = this.results.length > 0 ? 'block' : 'none';
    this.elements.loadMore.style.display = 
      !this.isLoading && this.hasMore ? 'block' : 'none';
    
    if (this.error) {
      this.elements.error.textContent = this.error;
    }
  }
  
  /**
   * Open dropdown
   */
  open() {
    this.isOpen = true;
    this.elements.list.style.display = 'block';
    this.elements.wrapper.setAttribute('aria-expanded', 'true');
    
    // Initial search if no results yet
    if (this.results.length === 0) {
      this.search();
    }
  }
  
  /**
   * Close dropdown
   */
  close() {
    this.isOpen = false;
    this.elements.list.style.display = 'none';
    this.elements.wrapper.setAttribute('aria-expanded', 'false');
    this.selectedIndex = -1;
  }
  
  /**
   * Get cached result
   */
  getCached(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  /**
   * Set cache
   */
  setCached(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Simple cache cleanup - remove old entries when cache gets too large
    if (this.cache.size > 50) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
  
  /**
   * Clean up
   */
  destroy() {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    if (this.abortController) {
      this.abortController.abort();
    }
    this.cache.clear();
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SearchableStopDropdown;
}
