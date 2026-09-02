import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useZoom, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM, STORAGE_KEY } from './useZoom';

describe('useZoom Hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with default zoom 1.0 when no stored preference exists', () => {
    const { result } = renderHook(() => useZoom());
    expect(result.current.zoomLevel).toBe(DEFAULT_ZOOM);
    expect(result.current.showIndicator).toBe(false);
  });

  it('restores valid zoom preference from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, '1.25');
    const { result } = renderHook(() => useZoom());
    expect(result.current.zoomLevel).toBe(1.25);
  });

  it('zooms in when Cmd + = is pressed', () => {
    const { result } = renderHook(() => useZoom());
    expect(result.current.zoomLevel).toBe(1.0);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '=', metaKey: true }));
    });

    expect(result.current.zoomLevel).toBe(1.1);
    expect(result.current.showIndicator).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1.1');
  });

  it('zooms out when Cmd + - is pressed', () => {
    const { result } = renderHook(() => useZoom());
    expect(result.current.zoomLevel).toBe(1.0);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '-', metaKey: true }));
    });

    expect(result.current.zoomLevel).toBe(0.9);
    expect(result.current.showIndicator).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('0.9');
  });

  it('resets zoom to 1.0 when Cmd + 0 is pressed', () => {
    const { result } = renderHook(() => useZoom());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '=', metaKey: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '=', metaKey: true }));
    });
    expect(result.current.zoomLevel).toBe(1.2);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '0', metaKey: true }));
    });
    expect(result.current.zoomLevel).toBe(1.0);
  });

  it('zooms in on Cmd + mouse scroll up (deltaY < 0)', () => {
    const { result } = renderHook(() => useZoom());
    expect(result.current.zoomLevel).toBe(1.0);

    act(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, metaKey: true }));
    });

    expect(result.current.zoomLevel).toBe(1.05);
    expect(result.current.showIndicator).toBe(true);
  });

  it('zooms out on Cmd + mouse scroll down (deltaY > 0)', () => {
    const { result } = renderHook(() => useZoom());
    expect(result.current.zoomLevel).toBe(1.0);

    act(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, metaKey: true }));
    });

    expect(result.current.zoomLevel).toBe(0.95);
    expect(result.current.showIndicator).toBe(true);
  });

  it('respects MIN_ZOOM and MAX_ZOOM bounds', () => {
    const { result } = renderHook(() => useZoom());

    // Zoom out past min
    for (let i = 0; i < 20; i++) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '-', metaKey: true }));
      });
    }
    expect(result.current.zoomLevel).toBe(MIN_ZOOM);

    // Zoom in past max
    for (let i = 0; i < 30; i++) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '=', metaKey: true }));
      });
    }
    expect(result.current.zoomLevel).toBe(MAX_ZOOM);
  });

  it('auto-hides indicator after 1500ms', () => {
    const { result } = renderHook(() => useZoom());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '=', metaKey: true }));
    });
    expect(result.current.showIndicator).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(result.current.showIndicator).toBe(false);
  });
});
