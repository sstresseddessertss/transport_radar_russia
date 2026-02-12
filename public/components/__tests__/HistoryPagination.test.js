/**
 * @jest-environment jsdom
 */

const HistoryPagination = require('../HistoryPagination');

describe('HistoryPagination Component', () => {
    let mockOnPageChange;

    beforeEach(() => {
        mockOnPageChange = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create an instance with default options', () => {
            const pagination = new HistoryPagination();
            expect(pagination.options.currentPage).toBe(1);
            expect(pagination.options.totalPages).toBe(1);
            expect(pagination.options.itemsPerPage).toBe(10);
            expect(pagination.element).toBeNull();
        });

        it('should accept custom options', () => {
            const pagination = new HistoryPagination({
                currentPage: 2,
                totalPages: 5,
                itemsPerPage: 20,
                totalItems: 100,
                onPageChange: mockOnPageChange
            });
            expect(pagination.options.currentPage).toBe(2);
            expect(pagination.options.totalPages).toBe(5);
            expect(pagination.options.itemsPerPage).toBe(20);
            expect(pagination.options.totalItems).toBe(100);
            expect(pagination.options.onPageChange).toBe(mockOnPageChange);
        });
    });

    describe('render', () => {
        it('should render a pagination element', () => {
            const pagination = new HistoryPagination({
                currentPage: 1,
                totalPages: 3,
                totalItems: 30
            });
            const element = pagination.render();

            expect(element).toBeInstanceOf(HTMLElement);
            expect(element.className).toBe('history-pagination');
            expect(element.getAttribute('role')).toBe('navigation');
            expect(element.getAttribute('aria-label')).toBe('Навигация по истории');
        });

        it('should display pagination info', () => {
            const pagination = new HistoryPagination({
                currentPage: 2,
                totalPages: 5,
                itemsPerPage: 10,
                totalItems: 50
            });
            const element = pagination.render();

            const info = element.querySelector('.pagination-info');
            expect(info).toBeTruthy();
            expect(info.textContent).toBe('11-20 из 50');
        });

        it('should disable previous button on first page', () => {
            const pagination = new HistoryPagination({
                currentPage: 1,
                totalPages: 3
            });
            const element = pagination.render();

            const buttons = element.querySelectorAll('.pagination-btn');
            const prevBtn = buttons[0];

            expect(prevBtn.textContent).toContain('Назад');
            expect(prevBtn.disabled).toBe(true);
        });

        it('should disable next button on last page', () => {
            const pagination = new HistoryPagination({
                currentPage: 3,
                totalPages: 3
            });
            const element = pagination.render();

            const buttons = element.querySelectorAll('.pagination-btn');
            const nextBtn = buttons[buttons.length - 1];

            expect(nextBtn.textContent).toContain('Вперёд');
            expect(nextBtn.disabled).toBe(true);
        });

        it('should mark current page as active', () => {
            const pagination = new HistoryPagination({
                currentPage: 2,
                totalPages: 5
            });
            const element = pagination.render();

            const pageButtons = element.querySelectorAll('.pagination-page');
            const activePage = Array.from(pageButtons).find(btn => 
                btn.classList.contains('active')
            );

            expect(activePage).toBeTruthy();
            expect(activePage.textContent).toBe('2');
            expect(activePage.getAttribute('aria-current')).toBe('page');
        });
    });

    describe('getPageNumbers', () => {
        it('should show all pages when total <= 7', () => {
            const pagination = new HistoryPagination({
                currentPage: 3,
                totalPages: 5
            });

            const pages = pagination.getPageNumbers();
            expect(pages).toEqual([1, 2, 3, 4, 5]);
        });

        it('should show ellipsis for many pages', () => {
            const pagination = new HistoryPagination({
                currentPage: 5,
                totalPages: 10
            });

            const pages = pagination.getPageNumbers();
            expect(pages).toContain('...');
            expect(pages).toContain(1);
            expect(pages).toContain(10);
            expect(pages).toContain(5);
        });

        it('should show first, last, current and neighbors', () => {
            const pagination = new HistoryPagination({
                currentPage: 5,
                totalPages: 10
            });

            const pages = pagination.getPageNumbers();
            expect(pages).toContain(4); // neighbor before
            expect(pages).toContain(5); // current
            expect(pages).toContain(6); // neighbor after
        });
    });

    describe('goToPage', () => {
        it('should call onPageChange callback', () => {
            const pagination = new HistoryPagination({
                currentPage: 1,
                totalPages: 5,
                onPageChange: mockOnPageChange
            });

            pagination.goToPage(2);

            expect(mockOnPageChange).toHaveBeenCalledTimes(1);
            expect(mockOnPageChange).toHaveBeenCalledWith(2);
            expect(pagination.options.currentPage).toBe(2);
        });

        it('should not change page if out of bounds', () => {
            const pagination = new HistoryPagination({
                currentPage: 1,
                totalPages: 5,
                onPageChange: mockOnPageChange
            });

            pagination.goToPage(0);
            expect(mockOnPageChange).not.toHaveBeenCalled();

            pagination.goToPage(6);
            expect(mockOnPageChange).not.toHaveBeenCalled();
        });

        it('should not change page if same as current', () => {
            const pagination = new HistoryPagination({
                currentPage: 2,
                totalPages: 5,
                onPageChange: mockOnPageChange
            });

            pagination.goToPage(2);
            expect(mockOnPageChange).not.toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('should update pagination options', () => {
            const pagination = new HistoryPagination({
                currentPage: 1,
                totalPages: 3
            });

            pagination.update({
                currentPage: 2,
                totalPages: 5,
                totalItems: 50
            });

            expect(pagination.options.currentPage).toBe(2);
            expect(pagination.options.totalPages).toBe(5);
            expect(pagination.options.totalItems).toBe(50);
        });
    });

    describe('destroy', () => {
        it('should remove element from DOM', () => {
            const pagination = new HistoryPagination({
                currentPage: 1,
                totalPages: 3
            });
            const element = pagination.render();
            
            const container = document.createElement('div');
            container.appendChild(element);

            expect(container.children.length).toBe(1);

            pagination.destroy();

            expect(container.children.length).toBe(0);
            expect(pagination.element).toBeNull();
        });
    });

    describe('snapshot', () => {
        it('should match snapshot for single page', () => {
            const pagination = new HistoryPagination({
                currentPage: 1,
                totalPages: 1,
                totalItems: 5
            });
            const element = pagination.render();

            expect(element).toMatchSnapshot();
        });

        it('should match snapshot for multiple pages', () => {
            const pagination = new HistoryPagination({
                currentPage: 3,
                totalPages: 10,
                totalItems: 100
            });
            const element = pagination.render();

            expect(element).toMatchSnapshot();
        });
    });
});
