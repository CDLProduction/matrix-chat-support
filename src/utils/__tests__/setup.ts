import { vi } from 'vitest';

// Mock DOM globals for Node.js environment
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000'
  },
  writable: true
});

// Mock fetch globally
global.fetch = vi.fn();

// Suppress console output during tests unless explicitly testing console behavior
const originalConsole = { ...console };
beforeEach(() => {
  // Restore console for each test
  Object.assign(console, originalConsole);
});

// Mock crypto for Node.js environment (used in ID generation)
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
  }
});

// Mock document for cookie operations
Object.defineProperty(global, 'document', {
  value: {
    cookie: ''
  },
  writable: true
});