import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

interface NamespaceMultiSelectProps {
  namespaces: string[];
  /** Empty array means "All Namespaces". */
  selected: string[];
  onChange: (selected: string[]) => void;
}

/**
 * Multi-select namespace filter, reused by the Pods table and the generic
 * resource table. An empty selection means "All Namespaces" — the same
 * sentinel the single-select dropdown used to encode as the literal string
 * "all", now represented structurally instead of as a magic value.
 */
export const NamespaceMultiSelect: React.FC<NamespaceMultiSelectProps> = ({
  namespaces,
  selected,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  const trimmedQuery = query.trim();
  const filtered = namespaces.filter((ns) => ns.toLowerCase().includes(trimmedQuery.toLowerCase()));
  const exactMatch = namespaces.some((ns) => ns.toLowerCase() === trimmedQuery.toLowerCase());

  const selectSingle = (ns: string) => {
    onChange([ns]);
    setIsOpen(false);
  };

  const toggleMulti = (ns: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.includes(ns) ? selected.filter((s) => s !== ns) : [...selected, ns]);
  };

  const handleCustomNamespaceSubmit = () => {
    if (!trimmedQuery) return;
    onChange([trimmedQuery]);
    setIsOpen(false);
  };

  const label =
    selected.length === 0
      ? 'All Namespaces'
      : selected.length === 1
      ? selected[0]
      : `${selected.length} namespaces`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center space-x-1.5 bg-surface-elevated border border-border rounded-md px-2.5 py-1 text-xs text-gray-200 hover:border-gray-500 transition-colors min-w-[9rem]"
      >
        <span className="flex-1 text-left truncate font-mono text-xs">{label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-72 rounded-lg bg-surface-elevated border border-border shadow-2xl z-50 overflow-hidden">
          <div className="relative px-2 py-2 border-b border-border bg-surface/30">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsOpen(false);
                } else if (e.key === 'Enter' && trimmedQuery) {
                  e.preventDefault();
                  if (filtered.length === 1) {
                    selectSingle(filtered[0]);
                  } else {
                    handleCustomNamespaceSubmit();
                  }
                }
              }}
              placeholder="Search or enter custom namespace…"
              className="w-full bg-surface border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <button
            onClick={() => {
              onChange([]);
              setIsOpen(false);
            }}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-surface-hover transition-colors border-b border-border/60"
          >
            <span className={selected.length === 0 ? 'text-indigo-300 font-medium' : 'text-gray-300'}>
              All Namespaces (Cluster-wide)
            </span>
            {selected.length === 0 && <Check className="w-3.5 h-3.5 text-indigo-400" />}
          </button>

          {/* Quick Add Custom Namespace if typed query does not exactly match existing */}
          {trimmedQuery && !exactMatch && (
            <button
              onClick={handleCustomNamespaceSubmit}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-200 border-b border-border/60 transition-colors"
            >
              <span className="truncate">
                Switch to custom: <strong className="font-mono text-indigo-300">"{trimmedQuery}"</strong>
              </span>
              <span className="text-[10px] bg-indigo-800/80 px-1.5 py-0.5 rounded text-indigo-100 font-mono">
                Enter ↵
              </span>
            </button>
          )}

          <div className="max-h-56 overflow-y-auto divide-y divide-border/20">
            {filtered.length === 0 && !trimmedQuery && (
              <div className="px-3 py-4 text-center text-xs text-gray-500">No namespaces found</div>
            )}
            {filtered.map((ns) => {
              const isSelected = selected.includes(ns);
              return (
                <div
                  key={ns}
                  onClick={() => selectSingle(ns)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-600/10 text-indigo-200' : 'text-gray-300 hover:bg-surface-hover hover:text-white'
                  }`}
                >
                  <span className="truncate font-mono text-xs flex-1">{ns}</span>
                  <button
                    type="button"
                    onClick={(e) => toggleMulti(ns, e)}
                    className="p-1 rounded hover:bg-surface text-gray-400 hover:text-white ml-2 transition-colors"
                    title="Toggle multi-select"
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${
                        isSelected ? 'bg-indigo-600 border-indigo-500' : 'border-gray-600'
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          {selected.length > 0 && (
            <button
              onClick={() => {
                onChange([]);
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 border-t border-border transition-colors bg-surface/50"
            >
              <X className="w-3 h-3" />
              <span>Reset to All Namespaces</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
