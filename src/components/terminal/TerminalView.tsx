import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { PodSummary } from '../../types/cluster';
import { Terminal as TerminalIcon, X, AlertCircle } from 'lucide-react';
import { api, isTauri } from '../../api/tauriClient';

interface TerminalViewProps {
  isActive: boolean;
  onClose: () => void;
  pod: PodSummary | null;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  isActive,
  onClose,
  pod,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstanceRef = useRef<Terminal | null>(null);
  const [containers, setContainers] = useState<string[]>([]);
  const [container, setContainer] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Discover containers for pod
  useEffect(() => {
    if (!isActive || !pod) return;
    api.listContainers(pod.namespace, pod.name)
      .then((names) => {
        setContainers(names);
        if (names.length > 0 && !container) {
          setContainer(names[0]);
        }
      })
      .catch(() => setContainers([]));
  }, [isActive, pod]);

  useEffect(() => {
    if (!isActive || !terminalRef.current || !pod) return;
    setError(null);
    let ignore = false;

    // Initialize xterm.js
    const term = new Terminal({
      theme: {
        background: '#090D16',
        foreground: '#F9FAFB',
        cursor: '#6366F1',
        selectionBackground: '#4338CA',
      },
      fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);
    try {
      fitAddon.fit();
    } catch {}
    termInstanceRef.current = term;

    const initialCols = term.cols || 80;
    const initialRows = term.rows || 24;

    term.writeln(`\x1b[1;34mk8sUI Interactive Exec Terminal (bash / sh / ash)\x1b[0m`);
    term.writeln(`Connecting to \x1b[32m${pod.namespace}/${pod.name}\x1b[0m${container ? ` [container: ${container}]` : ''}...\r\n`);

    let unlistenEvent: (() => void) | undefined;

    // Start real backend exec session with explicit initial dimensions
    api.startTerminal(pod.namespace, pod.name, container, initialCols, initialRows)
      .then(async (sessionId) => {
        if (ignore) return;
        sessionIdRef.current = sessionId;
        term.writeln(`\x1b[32m✔ Session established (${sessionId})\x1b[0m\r\n`);

        // Ensure backend PTY receives accurate dimensions once container layout settles
        try {
          fitAddon.fit();
          api.resizeTerminal(sessionId, term.cols, term.rows).catch(() => {});
        } catch {}

        if (isTauri) {
          try {
            const { listen } = await import('@tauri-apps/api/event');
            unlistenEvent = await listen<{ sessionId: string; data: string }>('terminal-data', (event) => {
              if (event.payload && event.payload.sessionId === sessionId) {
                term.write(event.payload.data);
              }
            });
          } catch (e) {
            console.error('Failed to bind tauri terminal listener', e);
          }
        }
      })
      .catch((err) => {
        if (ignore) return;
        const msg = err?.message || String(err);
        setError(msg);
        term.writeln(`\r\n\x1b[31m✖ Failed to connect exec session: ${msg}\x1b[0m\r\n`);
      });

    // Send user keystrokes into stdin stream
    const onDataDisposable = term.onData((data) => {
      if (sessionIdRef.current) {
        api.terminalInput(sessionIdRef.current, data).catch(() => {});
      }
    });

    const onResizeDisposable = term.onResize(({ cols, rows }) => {
      if (sessionIdRef.current) {
        api.resizeTerminal(sessionIdRef.current, cols, rows).catch(() => {});
      }
    });

    const handleResize = () => {
      try {
        fitAddon.fit();
        if (sessionIdRef.current) {
          api.resizeTerminal(sessionIdRef.current, term.cols, term.rows).catch(() => {});
        }
      } catch {}
    };

    window.addEventListener('resize', handleResize);

    // Observe size changes of the parent container (panel drag resize, minimize, maximize)
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }
    
    // Initial fit after a delay to ensure container is fully laid out
    setTimeout(() => {
      if (termInstanceRef.current) {
        handleResize();
      }
    }, 100);

    return () => {
      ignore = true;
      resizeObserver.disconnect();
      if (sessionIdRef.current) {
        api.closeTerminal(sessionIdRef.current).catch(() => {});
        sessionIdRef.current = null;
      }
      if (unlistenEvent) {
        unlistenEvent();
      }
      onDataDisposable.dispose();
      onResizeDisposable.dispose();
      window.removeEventListener('resize', handleResize);
      term.dispose();
      termInstanceRef.current = null;
    };
  }, [isActive, pod, container]);

  if (!isActive || !pod) return null;

  return (
    <div className="flex flex-col h-full w-full bg-[#090D16]">
      {/* Terminal Header */}
      <div className="px-4 py-2 border-b border-border bg-surface/70 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <TerminalIcon className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-bold text-gray-200">
              Interactive Exec: {pod.namespace}/{pod.name}
            </span>
            {containers.length > 1 && (
              <select
                value={container || ''}
                onChange={(e) => setContainer(e.target.value)}
                className="bg-surface-elevated border border-border rounded px-2 py-0.5 text-xs text-gray-300 font-mono"
              >
                {containers.map((c) => (
                  <option key={c} value={c}>
                    container: {c}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
              title="Close Terminal Session"
              aria-label="Close Terminal Session"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/80 border-b border-red-600 px-4 py-2 flex items-center space-x-2 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

      {/* Xterm container */}
      <div className="flex-1 p-3 bg-[#090D16] overflow-hidden min-h-0 relative">
        <div className="absolute inset-0 p-3" ref={terminalRef} />
      </div>
    </div>
  );
};
