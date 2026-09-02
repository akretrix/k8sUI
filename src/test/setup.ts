import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Automatically unmount React trees and clear timers after each test to prevent unclosed handles
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
});
