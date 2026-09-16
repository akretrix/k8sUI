/**
 * usePodWatch — Kubernetes Watch-stream hook for pods.
 *
 * This hook replaces the `useQuery(['pods', ...])` polling approach with a
 * Tauri event-listener model: the Rust backend maintains one persistent Watch
 * stream per cluster and pushes change events to the frontend in real-time.
 *
 * Lifecycle:
 *  1. On mount (or cluster change) — fire ONE `list_pods` call to hydrate the
 *     full initial state (includes CPU/Memory from the metrics-server, which
 *     the watch stream cannot provide).
 *  2. Start listening for watch events emitted by the Rust WatchManager:
 *       "pods:applied"     → upsert pod in local state
 *       "pods:deleted"     → remove pod from local state
 *       "pods:watch_ready" → mark stream as live
 *       "pods:watch_error" → log warning; stream auto-restarts on Rust side
 *  3. Periodically refresh metrics (CPU/Memory) via a slow poll — every 60 s
 *     is sufficient because the watch handles status/lifecycle changes.
 *  4. On unmount or cluster switch — clean up all listeners.
 *
 * In browser (non-Tauri) mode the hook falls back to the old polling behaviour
 * so the mock dev server still works correctly.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { api, isTauri } from '../api/tauriClient';
import type { PodSummary } from '../types/cluster';

/** Payload emitted by "pods:deleted" events */
interface PodRef {
  name: string;
  namespace: string;
}

interface UsePodWatchResult {
  pods: PodSummary[];
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  /** Whether the watch stream is established and live on the backend */
  isWatchLive: boolean;
  /** Force a full re-sync (hydrate + restart watch) */
  refetch: () => void;
}

// How often to refresh CPU/Memory metrics when the watch is live.
// Status/lifecycle changes arrive instantly via the watch; metrics are a slow
// background concern (metrics-server scrapes every 15 s by default anyway).
const METRICS_REFRESH_INTERVAL_MS = 60_000;

// Fallback polling interval used in browser mode (no Tauri events available)
const BROWSER_POLL_INTERVAL_MS = 15_000;

export function usePodWatch(
  activeClusterId: string | undefined,
  selectedNamespaces: string[],
  enabled: boolean,
): UsePodWatchResult {
  const [pods, setPods] = useState<PodSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWatchLive, setIsWatchLive] = useState(false);

  // Ref to the metrics refresh timer so we can clear it on unmount
  const metricsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref to the browser-mode poll timer
  const browserPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derive the server-side namespace filter (mirrors App.tsx logic)
  const namespaceFn = useCallback(
    () => (selectedNamespaces.length === 1 ? selectedNamespaces[0] : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedNamespaces.join(',')],
  );

  /** Fetch the full pod list and hydrate state (also refreshes CPU/Memory). */
  const hydrate = useCallback(async () => {
    if (!enabled) return;
    setIsLoading((prev) => (pods.length === 0 ? true : prev));
    setIsError(false);
    setError(null);
    try {
      const fetched = await api.listPods(namespaceFn());
      setPods(fetched);
    } catch (err: any) {
      setIsError(true);
      setError(err?.message ?? String(err));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, namespaceFn]);

  /** Merge a single incoming PodSummary from the watch stream into state. */
  const upsertPod = useCallback((incoming: PodSummary) => {
    setPods((prev) => {
      const idx = prev.findIndex(
        (p) => p.name === incoming.name && p.namespace === incoming.namespace,
      );
      if (idx >= 0) {
        const next = [...prev];
        // Preserve the last known CPU/Memory from metrics — the watch event
        // does not carry metrics-server data.
        next[idx] = {
          ...incoming,
          cpu: incoming.cpu ?? prev[idx].cpu,
          memory: incoming.memory ?? prev[idx].memory,
        };
        return next;
      }
      return [...prev, incoming];
    });
  }, []);

  /** Remove a pod from state based on name + namespace. */
  const deletePod = useCallback((ref: PodRef) => {
    setPods((prev) =>
      prev.filter((p) => !(p.name === ref.name && p.namespace === ref.namespace)),
    );
  }, []);

  useEffect(() => {
    if (!enabled || !activeClusterId) return;

    let cancelled = false;
    let unlisteners: Array<() => void> = [];

    const setup = async () => {
      // Step 1: Hydrate with one full list (includes metrics)
      await hydrate();

      if (cancelled) return;

      if (isTauri) {
        // Step 2a: Tauri mode — attach watch-stream listeners
        try {
          const { listen } = await import('@tauri-apps/api/event');

          const [unApplied, unDeleted, unReady, unError] = await Promise.all([
            listen<PodSummary>('pods:applied', ({ payload }) => {
              if (!cancelled) upsertPod(payload);
            }),
            listen<PodRef>('pods:deleted', ({ payload }) => {
              if (!cancelled) deletePod(payload);
            }),
            listen<void>('pods:watch_ready', () => {
              if (!cancelled) setIsWatchLive(true);
            }),
            listen<string>('pods:watch_error', ({ payload }) => {
              console.warn('[usePodWatch] Watch error (auto-restarting):', payload);
              if (!cancelled) setIsWatchLive(false);
            }),
          ]);

          unlisteners = [unApplied, unDeleted, unReady, unError];

          // Step 3: Slow metrics refresh (CPU/Memory only — use list_pods)
          metricsTimerRef.current = setInterval(async () => {
            if (cancelled) return;
            try {
              const refreshed = await api.listPods(namespaceFn());
              if (!cancelled) {
                // Only update CPU/Memory fields to avoid overwriting live
                // status data that came from the watch stream.
                setPods((prev) =>
                  prev.map((p) => {
                    const fresh = refreshed.find(
                      (r) => r.name === p.name && r.namespace === p.namespace,
                    );
                    if (!fresh) return p;
                    return { ...p, cpu: fresh.cpu, memory: fresh.memory };
                  }),
                );
              }
            } catch {
              // Metrics failure is non-fatal; stale values stay in place
            }
          }, METRICS_REFRESH_INTERVAL_MS);
        } catch (err) {
          console.error('[usePodWatch] Failed to attach listeners:', err);
        }
      } else {
        // Step 2b: Browser mode — fall back to simple polling
        browserPollTimerRef.current = setInterval(() => {
          if (!cancelled) hydrate();
        }, BROWSER_POLL_INTERVAL_MS);
      }
    };

    setup();

    return () => {
      cancelled = true;
      setIsWatchLive(false);
      unlisteners.forEach((fn) => fn());
      if (metricsTimerRef.current) {
        clearInterval(metricsTimerRef.current);
        metricsTimerRef.current = null;
      }
      if (browserPollTimerRef.current) {
        clearInterval(browserPollTimerRef.current);
        browserPollTimerRef.current = null;
      }
    };
  }, [activeClusterId, enabled, namespaceFn, hydrate, upsertPod, deletePod]);

  return { pods, isLoading, isError, error: error, isWatchLive, refetch: hydrate };
}
