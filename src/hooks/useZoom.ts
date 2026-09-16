import { useState, useEffect, useRef, useCallback } from 'react';
import { isTauri } from '../api/tauriClient';

export const MIN_ZOOM = 0.7;
export const MAX_ZOOM = 1.8;
export const DEFAULT_ZOOM = 1.0;
export const ZOOM_STEP_KEYBOARD = 0.1;
export const ZOOM_STEP_WHEEL = 0.05;
export const STORAGE_KEY = 'akretrix_ui_zoom';

export function useZoom() {
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM) {
          return Math.round(parsed * 100) / 100;
        }
      }
    } catch {
      // Fallback to default
    }
    return DEFAULT_ZOOM;
  });

  const [showIndicator, setShowIndicator] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingZoomRef = useRef<number | null>(null);
  const isApplyingZoomRef = useRef<boolean>(false);

  const displayIndicator = useCallback(() => {
    setShowIndicator(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setShowIndicator(false);
    }, 1500);
  }, []);

  const changeZoom = useCallback(
    (updater: (prev: number) => number) => {
      setZoomLevel((prev) => {
        const target = updater(prev);
        const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(target * 100) / 100));
        return clamped;
      });
      displayIndicator();
    },
    [displayIndicator]
  );

  const resetZoom = useCallback(() => {
    setZoomLevel(DEFAULT_ZOOM);
    displayIndicator();
  }, [displayIndicator]);

  // Apply zoom factor:
  // - Purge any CSS zoom from document/body (which causes WebKit viewport clipping and black background voids)
  // - In desktop Tauri, use native Webview pageZoom via setZoom()
  // - In browser mock mode, adjust root style scaling safely while maintaining 100% viewport coverage
  useEffect(() => {
    // 1. Purge destructive document/body CSS zoom if present
    if (typeof document !== 'undefined') {
      document.documentElement.style.zoom = '';
      if (document.body) {
        (document.body.style as any).zoom = '';
      }
    }

    // 2. Persist in localStorage
    try {
      localStorage.setItem(STORAGE_KEY, String(zoomLevel));
    } catch (e) {
      console.warn('Failed to persist zoom level:', e);
    }

    // 3. Apply zoom natively in Tauri or via safe root sizing in browser
    pendingZoomRef.current = zoomLevel;
    const applyZoom = async () => {
      if (isApplyingZoomRef.current) return;
      isApplyingZoomRef.current = true;
      while (pendingZoomRef.current !== null) {
        const target = pendingZoomRef.current;
        pendingZoomRef.current = null;
        if (isTauri) {
          try {
            const { getCurrentWebview } = await import('@tauri-apps/api/webview');
            await getCurrentWebview().setZoom(target);
          } catch (err) {
            console.warn('Failed to set native webview zoom:', err);
          }
        } else if (typeof document !== 'undefined') {
          const root = document.getElementById('root');
          if (root) {
            if (target === DEFAULT_ZOOM) {
              root.style.zoom = '';
              root.style.width = '100%';
              root.style.height = '100%';
            } else {
              root.style.zoom = String(target);
              root.style.width = `${Math.round((100 / target) * 100) / 100}%`;
              root.style.height = `${Math.round((100 / target) * 100) / 100}%`;
            }
          }
        }
      }
      isApplyingZoomRef.current = false;
    };
    applyZoom();
  }, [zoomLevel]);

  // Keyboard shortcuts (Cmd+= / Cmd+- / Cmd+0) and Mouse Wheel (Cmd + scroll)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;

      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        changeZoom((prev) => prev + ZOOM_STEP_KEYBOARD);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        changeZoom((prev) => prev - ZOOM_STEP_KEYBOARD);
      } else if (e.key === '0') {
        e.preventDefault();
        resetZoom();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;

      // Prevent native browser / OS zoom or scrolling
      e.preventDefault();

      if (e.deltaY < 0) {
        // Scrolling up -> zoom in
        changeZoom((prev) => prev + ZOOM_STEP_WHEEL);
      } else if (e.deltaY > 0) {
        // Scrolling down -> zoom out
        changeZoom((prev) => prev - ZOOM_STEP_WHEEL);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [changeZoom, resetZoom]);

  return {
    zoomLevel,
    showIndicator,
    resetZoom,
    setZoomLevel: changeZoom,
  };
}
