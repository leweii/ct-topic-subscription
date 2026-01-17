import '@testing-library/jest-dom';

// Only set up browser mocks when in jsdom environment
if (typeof window !== 'undefined') {
  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  // Mock navigator.language
  Object.defineProperty(navigator, 'language', {
    value: 'en-US',
    writable: true,
    configurable: true,
  });

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });
}

// Mock fetch globally
global.fetch = jest.fn();

// Reset fetch mock before each test
beforeEach(() => {
  (global.fetch as jest.Mock).mockClear();
});
