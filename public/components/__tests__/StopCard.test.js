/**
 * @jest-environment jsdom
 */

const StopCard = require('../StopCard');

describe('StopCard Component', () => {
    let stopData;
    let mockOnSelect;

    beforeEach(() => {
        stopData = {
            uuid: 'test-uuid-123',
            name: 'Тестовая остановка',
            direction: 'в сторону центра'
        };
        mockOnSelect = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create an instance with stop data', () => {
            const card = new StopCard(stopData);
            expect(card.stop).toEqual(stopData);
            expect(card.element).toBeNull();
        });

        it('should accept an onSelect callback', () => {
            const card = new StopCard(stopData, mockOnSelect);
            expect(card.onSelect).toBe(mockOnSelect);
        });
    });

    describe('render', () => {
        it('should render a stop card element', () => {
            const card = new StopCard(stopData);
            const element = card.render();

            expect(element).toBeInstanceOf(HTMLElement);
            expect(element.className).toBe('stop-card');
            expect(element.getAttribute('role')).toBe('button');
            expect(element.getAttribute('tabindex')).toBe('0');
        });

        it('should display stop name and direction', () => {
            const card = new StopCard(stopData);
            const element = card.render();

            const nameDiv = element.querySelector('.stop-card-name');
            const directionDiv = element.querySelector('.stop-card-direction');

            expect(nameDiv).toBeTruthy();
            expect(nameDiv.textContent).toBe(stopData.name);
            expect(directionDiv).toBeTruthy();
            expect(directionDiv.textContent).toBe(stopData.direction);
        });

        it('should have proper aria-label', () => {
            const card = new StopCard(stopData);
            const element = card.render();

            const expectedLabel = `Остановка ${stopData.name} в направлении ${stopData.direction}`;
            expect(element.getAttribute('aria-label')).toBe(expectedLabel);
        });

        it('should call onSelect when clicked', () => {
            const card = new StopCard(stopData, mockOnSelect);
            const element = card.render();

            element.click();

            expect(mockOnSelect).toHaveBeenCalledTimes(1);
            expect(mockOnSelect).toHaveBeenCalledWith(stopData);
        });

        it('should call onSelect when Enter key is pressed', () => {
            const card = new StopCard(stopData, mockOnSelect);
            const element = card.render();

            const event = new KeyboardEvent('keydown', { key: 'Enter' });
            element.dispatchEvent(event);

            expect(mockOnSelect).toHaveBeenCalledTimes(1);
            expect(mockOnSelect).toHaveBeenCalledWith(stopData);
        });

        it('should call onSelect when Space key is pressed', () => {
            const card = new StopCard(stopData, mockOnSelect);
            const element = card.render();

            const event = new KeyboardEvent('keydown', { key: ' ' });
            element.dispatchEvent(event);

            expect(mockOnSelect).toHaveBeenCalledTimes(1);
            expect(mockOnSelect).toHaveBeenCalledWith(stopData);
        });
    });

    describe('update', () => {
        it('should update stop data', () => {
            const card = new StopCard(stopData);
            card.render();

            const newStopData = {
                uuid: 'new-uuid',
                name: 'Новая остановка',
                direction: 'на север'
            };

            card.update(newStopData);

            expect(card.stop).toEqual(newStopData);
        });

        it('should update rendered element content', () => {
            const card = new StopCard(stopData);
            const element = card.render();

            const newStopData = {
                uuid: 'new-uuid',
                name: 'Новая остановка',
                direction: 'на север'
            };

            card.update(newStopData);

            const nameDiv = element.querySelector('.stop-card-name');
            const directionDiv = element.querySelector('.stop-card-direction');

            expect(nameDiv.textContent).toBe(newStopData.name);
            expect(directionDiv.textContent).toBe(newStopData.direction);
        });
    });

    describe('destroy', () => {
        it('should remove element from DOM', () => {
            const card = new StopCard(stopData);
            const element = card.render();
            
            const container = document.createElement('div');
            container.appendChild(element);

            expect(container.children.length).toBe(1);

            card.destroy();

            expect(container.children.length).toBe(0);
            expect(card.element).toBeNull();
        });
    });

    describe('snapshot', () => {
        it('should match snapshot', () => {
            const card = new StopCard(stopData, mockOnSelect);
            const element = card.render();

            expect(element).toMatchSnapshot();
        });
    });
});
