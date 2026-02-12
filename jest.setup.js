// Setup file for Jest
require('@testing-library/jest-dom');

// Mock fetch API for tests
global.fetch = jest.fn();

// Mock Notification API
global.Notification = {
  permission: 'default',
  requestPermission: jest.fn(() => Promise.resolve('granted'))
};

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
