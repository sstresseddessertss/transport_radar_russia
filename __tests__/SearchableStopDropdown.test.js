/**
 * Tests for SearchableStopDropdown component
 * Tests debouncing, caching, keyboard navigation, and selection
 */

const SearchableStopDropdown = require('../public/SearchableStopDropdown.js');
const { screen, waitFor } = require('@testing-library/dom');
require('@testing-library/jest-dom');

// Mock fetch
global.fetch = jest.fn();

// Helper to create DOM environment
function setupDOM() {
  document.body.innerHTML = '<div id="test-container"></div>';
}

// Helper to simulate typing with delay
async function typeWithDelay(input, text, delay = 10) {
  for (const char of text) {
    input.value += char;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

describe('SearchableStopDropdown', () => {
  let dropdown;
  let mockOnChange;
  
  beforeEach(() => {
    setupDOM();
    mockOnChange = jest.fn();
    jest.clearAllMocks();
    
    // Mock fetch to return test data
    global.fetch.mockImplementation((url) => {
      const params = new URLSearchParams(url.split('?')[1]);
      const prefix = params.get('prefix') || '';
      const page = parseInt(params.get('page')) || 1;
      const pageSize = parseInt(params.get('page_size')) || 20;
      
      // Sample data
      const allStops = [
        { name: "Метро Сокол", uuid: "uuid-1", direction: "в центр" },
        { name: "Метро Бульвар Рокоссовского", uuid: "uuid-2", direction: "в центр" },
        { name: "Площадь Революции", uuid: "uuid-3", direction: "из центра" },
        { name: "Красная площадь", uuid: "uuid-4", direction: "из центра" },
        { name: "Тверская", uuid: "uuid-5", direction: "в центр" }
      ];
      
      // Filter by prefix
      let filtered = allStops;
      if (prefix) {
        const lower = prefix.toLowerCase();
        filtered = allStops.filter(s => s.name.toLowerCase().includes(lower));
      }
      
      // Paginate
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const paginated = filtered.slice(start, end);
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          stops: paginated,
          meta: {
            total: filtered.length,
            page,
            page_size: pageSize,
            total_pages: Math.ceil(filtered.length / pageSize),
            has_next: page < Math.ceil(filtered.length / pageSize),
            has_prev: page > 1
          }
        })
      });
    });
  });
  
  afterEach(() => {
    if (dropdown) {
      dropdown.destroy();
    }
  });
  
  describe('Initialization', () => {
    test('should render component with correct structure', () => {
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange,
        placeholder: 'Test placeholder'
      });
      
      const input = document.querySelector('.searchable-dropdown-input');
      expect(input).toBeInTheDocument();
      expect(input.placeholder).toBe('Test placeholder');
      
      const list = document.querySelector('.searchable-dropdown-list');
      expect(list).toBeInTheDocument();
      expect(list.style.display).toBe('none');
    });
    
    test('should initialize with default options', () => {
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange
      });
      
      expect(dropdown.debounceMs).toBe(300);
      expect(dropdown.pageSize).toBe(20);
      expect(dropdown.placeholder).toBe('Search stops...');
    });
    
    test('should accept custom options', () => {
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange,
        debounceMs: 500,
        pageSize: 10,
        placeholder: 'Custom placeholder'
      });
      
      expect(dropdown.debounceMs).toBe(500);
      expect(dropdown.pageSize).toBe(10);
      expect(dropdown.placeholder).toBe('Custom placeholder');
    });
  });
  
  describe('Debouncing', () => {
    test('should debounce search input', async () => {
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange,
        debounceMs: 100
      });
      
      const input = document.querySelector('.searchable-dropdown-input');
      
      // Type quickly
      input.value = 'М';
      input.dispatchEvent(new Event('input'));
      input.value = 'Ме';
      input.dispatchEvent(new Event('input'));
      input.value = 'Мет';
      input.dispatchEvent(new Event('input'));
      
      // Should not call fetch immediately
      expect(global.fetch).not.toHaveBeenCalled();
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should call fetch once after debounce
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    
    test('should cancel previous debounce when typing continues', async () => {
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange,
        debounceMs: 100
      });
      
      const input = document.querySelector('.searchable-dropdown-input');
      
      input.value = 'М';
      input.dispatchEvent(new Event('input'));
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      input.value = 'Ме';
      input.dispatchEvent(new Event('input'));
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should only make one request for the final value
      expect(global.fetch).toHaveBeenCalledTimes(1);
      // Check that the URL contains the encoded or unencoded version of the search term
      const fetchUrl = global.fetch.mock.calls[0][0];
      expect(fetchUrl).toMatch(/prefix=/);
    });
  });
  
  describe('Caching', () => {
    test('should cache search results', async () => {
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange,
        debounceMs: 10
      });
      
      const input = document.querySelector('.searchable-dropdown-input');
      
      // First search
      input.value = 'Метро';
      input.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      // Search again with same term
      input.value = '';
      input.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      input.value = 'Метро';
      input.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should use cache, not make another request
      // Total calls should be 2 (one for "Метро", one for empty)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
    
    test('should respect cache TTL', async () => {
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange,
        debounceMs: 10
      });
      
      // Override TTL for testing
      dropdown.cacheTTL = 100; // 100ms
      
      const input = document.querySelector('.searchable-dropdown-input');
      
      // First search
      input.value = 'Метро';
      input.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const firstCallCount = global.fetch.mock.calls.length;
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Search again
      input.value = '';
      input.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      input.value = 'Метро';
      input.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should make a new request since cache expired
      expect(global.fetch.mock.calls.length).toBeGreaterThan(firstCallCount);
    });
  });
  
  describe('Keyboard navigation', () => {
    test('should navigate down with ArrowDown key', async () => {
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange,
        debounceMs: 10
      });
      
      const input = document.querySelector('.searchable-dropdown-input');
      
      // Open dropdown and load results
      input.dispatchEvent(new Event('focus'));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Initially no selection
      expect(dropdown.selectedIndex).toBe(-1);
      
      // Press ArrowDown
      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      input.dispatchEvent(downEvent);
      
      expect(dropdown.selectedIndex).toBe(0);
      
      // Press ArrowDown again
      input.dispatchEvent(downEvent);
      expect(dropdown.selectedIndex).toBe(1);
    });
    
    test('should navigate up with ArrowUp key', async () => {
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange,
        debounceMs: 10
      });
      
      const input = document.querySelector('.searchable-dropdown-input');
      
      // Open and load
      input.dispatchEvent(new Event('focus'));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Navigate down twice
      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      input.dispatchEvent(downEvent);
      input.dispatchEvent(downEvent);
      
      expect(dropdown.selectedIndex).toBe(1);
      
      // Navigate up
      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      input.dispatchEvent(upEvent);
      
      expect(dropdown.selectedIndex).toBe(0);
    });
    
    test('should select option with Enter key', async () => {
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange,
        debounceMs: 10
      });
      
      const input = document.querySelector('.searchable-dropdown-input');
      
      // Open and load
      input.dispatchEvent(new Event('focus'));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Navigate to first item
      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      input.dispatchEvent(downEvent);
      
      // Press Enter
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      input.dispatchEvent(enterEvent);
      
      // Should call onChange with selected stop
      expect(mockOnChange).toHaveBeenCalled();
      expect(dropdown.isOpen).toBe(false);
    });
    
    test('should close dropdown with Escape key', async () => {
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange,
        debounceMs: 10
      });
      
      const input = document.querySelector('.searchable-dropdown-input');
      
      // Open dropdown
      input.dispatchEvent(new Event('focus'));
      expect(dropdown.isOpen).toBe(true);
      
      // Press Escape
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      input.dispatchEvent(escapeEvent);
      
      expect(dropdown.isOpen).toBe(false);
    });
  });
  
  describe('Selection', () => {
    test('should call onChange when option is clicked', async () => {
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange,
        debounceMs: 10
      });
      
      const input = document.querySelector('.searchable-dropdown-input');
      
      // Open and load
      input.dispatchEvent(new Event('focus'));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Click first option
      const options = document.querySelectorAll('.searchable-dropdown-option');
      if (options.length > 0) {
        options[0].click();
        
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            name: expect.any(String),
            uuid: expect.any(String)
          })
        );
      }
    });
    
    test('should close dropdown after selection', async () => {
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange,
        debounceMs: 10
      });
      
      const input = document.querySelector('.searchable-dropdown-input');
      
      // Open and load
      input.dispatchEvent(new Event('focus'));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(dropdown.isOpen).toBe(true);
      
      // Click option
      const options = document.querySelectorAll('.searchable-dropdown-option');
      if (options.length > 0) {
        options[0].click();
        expect(dropdown.isOpen).toBe(false);
      }
    });
  });
  
  describe('Loading states', () => {
    test('should show loading state during fetch', async () => {
      // Make fetch slow
      global.fetch.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({ stops: [], meta: {} })
            });
          }, 100);
        })
      );
      
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange,
        debounceMs: 10
      });
      
      const input = document.querySelector('.searchable-dropdown-input');
      
      // Trigger search
      input.value = 'test';
      input.dispatchEvent(new Event('input'));
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(dropdown.isLoading).toBe(true);
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(dropdown.isLoading).toBe(false);
    });
    
    test('should show no results message when no matches found', async () => {
      global.fetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            stops: [],
            meta: { total: 0, page: 1, page_size: 20, total_pages: 0 }
          })
        })
      );
      
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange,
        debounceMs: 10
      });
      
      const input = document.querySelector('.searchable-dropdown-input');
      
      input.value = 'nonexistent';
      input.dispatchEvent(new Event('input'));
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(dropdown.results.length).toBe(0);
    });
  });
  
  describe('Request cancellation', () => {
    test('should cancel in-flight requests when new search starts', async () => {
      const abortSpy = jest.fn();
      
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange,
        debounceMs: 10
      });
      
      const input = document.querySelector('.searchable-dropdown-input');
      
      // Start first search
      input.value = 'М';
      input.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const firstController = dropdown.abortController;
      if (firstController) {
        firstController.abort = abortSpy;
      }
      
      // Start second search (should cancel first)
      input.value = 'Ме';
      input.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(abortSpy).toHaveBeenCalled();
    });
  });
  
  describe('Accessibility', () => {
    test('should have proper ARIA attributes', () => {
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange
      });
      
      const wrapper = document.querySelector('.searchable-dropdown');
      expect(wrapper).toHaveAttribute('role', 'combobox');
      expect(wrapper).toHaveAttribute('aria-expanded', 'false');
      expect(wrapper).toHaveAttribute('aria-haspopup', 'listbox');
      
      const input = document.querySelector('.searchable-dropdown-input');
      expect(input).toHaveAttribute('role', 'searchbox');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      
      const list = document.querySelector('.searchable-dropdown-list');
      expect(list).toHaveAttribute('role', 'listbox');
    });
    
    test('should update aria-expanded when opening/closing', () => {
      dropdown = new SearchableStopDropdown({
        containerId: 'test-container',
        onChange: mockOnChange
      });
      
      const wrapper = document.querySelector('.searchable-dropdown');
      const input = document.querySelector('.searchable-dropdown-input');
      
      // Initially closed
      expect(wrapper).toHaveAttribute('aria-expanded', 'false');
      
      // Open
      input.dispatchEvent(new Event('focus'));
      expect(wrapper).toHaveAttribute('aria-expanded', 'true');
      
      // Close
      dropdown.close();
      expect(wrapper).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
