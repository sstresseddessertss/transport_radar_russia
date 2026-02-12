/**
 * @jest-environment jsdom
 */

const ArrivalList = require('../ArrivalList');

describe('ArrivalList Component', () => {
    let arrivals;
    let mockOnExpand;

    beforeEach(() => {
        arrivals = [
            {
                tramNumber: '3',
                forecasts: [
                    { minutes: 2, byTelemetry: true },
                    { minutes: 7, byTelemetry: false }
                ],
                history: [
                    { displayTime: '14:30' },
                    { displayTime: '14:15' }
                ]
            },
            {
                tramNumber: '39',
                forecasts: [
                    { minutes: 5, byTelemetry: true }
                ],
                history: []
            }
        ];
        mockOnExpand = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create an instance with arrivals data', () => {
            const list = new ArrivalList(arrivals);
            expect(list.arrivals).toEqual(arrivals);
            expect(list.element).toBeNull();
        });

        it('should accept options', () => {
            const list = new ArrivalList(arrivals, {
                showHistory: true,
                onExpand: mockOnExpand
            });
            expect(list.options.showHistory).toBe(true);
            expect(list.options.onExpand).toBe(mockOnExpand);
        });
    });

    describe('render', () => {
        it('should render an arrival list element', () => {
            const list = new ArrivalList(arrivals);
            const element = list.render();

            expect(element).toBeInstanceOf(HTMLElement);
            expect(element.className).toBe('arrival-list');
            expect(element.getAttribute('role')).toBe('list');
        });

        it('should display empty message when no arrivals', () => {
            const list = new ArrivalList([]);
            const element = list.render();

            const emptyMessage = element.querySelector('.no-arrivals');
            expect(emptyMessage).toBeTruthy();
            expect(emptyMessage.textContent).toBe('Нет данных о прибытии');
        });

        it('should render all arrival items', () => {
            const list = new ArrivalList(arrivals);
            const element = list.render();

            const items = element.querySelectorAll('.arrival-item');
            expect(items.length).toBe(arrivals.length);
        });

        it('should display tram numbers', () => {
            const list = new ArrivalList(arrivals);
            const element = list.render();

            const tramNumbers = element.querySelectorAll('.arrival-tram-number');
            expect(tramNumbers[0].textContent).toBe('3');
            expect(tramNumbers[1].textContent).toBe('39');
        });

        it('should display forecast times with correct badges', () => {
            const list = new ArrivalList(arrivals);
            const element = list.render();

            const firstItem = element.querySelectorAll('.arrival-item')[0];
            const badges = firstItem.querySelectorAll('.time-badge');

            expect(badges.length).toBe(2);
            expect(badges[0].classList.contains('time-telemetry')).toBe(true);
            expect(badges[0].textContent).toBe('2 мин');
            expect(badges[1].classList.contains('time-schedule')).toBe(true);
            expect(badges[1].textContent).toBe('7 мин');
        });

        it('should show history when enabled', () => {
            const list = new ArrivalList(arrivals, { showHistory: true });
            const element = list.render();

            const firstItem = element.querySelectorAll('.arrival-item')[0];
            const history = firstItem.querySelector('.arrival-history');

            expect(history).toBeTruthy();
        });

        it('should not show history when disabled', () => {
            const list = new ArrivalList(arrivals, { showHistory: false });
            const element = list.render();

            const firstItem = element.querySelectorAll('.arrival-item')[0];
            const history = firstItem.querySelector('.arrival-history');

            expect(history).toBeFalsy();
        });

        it('should toggle history on click', () => {
            const list = new ArrivalList(arrivals, { showHistory: true, onExpand: mockOnExpand });
            const element = list.render();

            const firstItem = element.querySelectorAll('.arrival-item')[0];
            const mainContent = firstItem.querySelector('.arrival-main-content');
            const history = firstItem.querySelector('.arrival-history');

            // Initially hidden
            expect(history.style.display).toBe('none');

            // Click to expand
            mainContent.click();

            expect(history.style.display).toBe('block');
            expect(mockOnExpand).toHaveBeenCalledWith('3', true);

            // Click to collapse
            mainContent.click();

            expect(history.style.display).toBe('none');
            expect(mockOnExpand).toHaveBeenCalledWith('3', false);
        });
    });

    describe('update', () => {
        it('should update arrivals data', () => {
            const list = new ArrivalList(arrivals);
            list.render();

            const newArrivals = [
                {
                    tramNumber: '47',
                    forecasts: [{ minutes: 3, byTelemetry: true }],
                    history: []
                }
            ];

            list.update(newArrivals);

            expect(list.arrivals).toEqual(newArrivals);
        });
    });

    describe('destroy', () => {
        it('should remove element from DOM', () => {
            const list = new ArrivalList(arrivals);
            const element = list.render();
            
            const container = document.createElement('div');
            container.appendChild(element);

            expect(container.children.length).toBe(1);

            list.destroy();

            expect(container.children.length).toBe(0);
            expect(list.element).toBeNull();
        });
    });

    describe('snapshot', () => {
        it('should match snapshot', () => {
            const list = new ArrivalList(arrivals, { showHistory: true });
            const element = list.render();

            expect(element).toMatchSnapshot();
        });
    });
});
