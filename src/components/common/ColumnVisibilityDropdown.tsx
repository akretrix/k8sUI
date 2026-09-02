import React, { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, Check, RotateCcw } from 'lucide-react';

export interface ColumnDefinition {
  id: string;
  label: string;
  visible: boolean;
  locked?: boolean;
}

interface ColumnVisibilityDropdownProps {
  columns: ColumnDefinition[];
  onChange: (updatedColumns: ColumnDefinition[]) => void;
  storageKey?: string;
}

export const ColumnVisibilityDropdown: React.FC<ColumnVisibilityDropdownProps> = ({
  columns,
  onChange,
  storageKey,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleColumn = (id: string) => {
    const updated = columns.map((col) =>
      col.id === id && !col.locked ? { ...col, visible: !col.visible } : col
    );
    onChange(updated);
    if (storageKey) {
      const visibilityMap = updated.reduce<Record<string, boolean>>((acc, c) => {
        acc[c.id] = c.visible;
        return acc;
      }, {});
      localStorage.setItem(storageKey, JSON.stringify(visibilityMap));
    }
  };

  const resetToDefault = () => {
    const resetCols = columns.map((col) => ({ ...col, visible: true }));
    onChange(resetCols);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  };

  const visibleCount = columns.filter((c) => c.visible).length;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-mono border transition-colors ${
          isOpen
            ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700'
            : 'bg-surface-elevated hover:bg-surface-hover text-gray-300 hover:text-white border-border'
        }`}
        title="Show or hide table columns"
      >
        <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
        <span>Columns</span>
        <span className="px-1.5 py-0.2 rounded bg-[#0B0F17] text-[10px] text-gray-400 border border-border/80">
          {visibleCount}/{columns.length}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-surface-elevated border border-border rounded-xl shadow-2xl z-50 overflow-hidden font-mono text-xs animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Header */}
          <div className="px-3 py-2 border-b border-border bg-surface flex items-center justify-between">
            <span className="font-semibold text-gray-200">Table Columns</span>
            <button
              onClick={resetToDefault}
              className="text-[10px] text-indigo-300 hover:text-indigo-200 flex items-center space-x-1"
              title="Reset to default columns"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* List of Columns */}
          <div className="p-2 space-y-0.5 max-h-64 overflow-y-auto">
            {columns.map((col) => (
              <label
                key={col.id}
                onClick={(e) => {
                  if (col.locked) return;
                  e.preventDefault();
                  toggleColumn(col.id);
                }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                  col.locked
                    ? 'opacity-60 cursor-not-allowed text-gray-500'
                    : col.visible
                    ? 'bg-surface/50 text-gray-200 hover:bg-surface'
                    : 'text-gray-400 hover:bg-surface/30'
                }`}
              >
                <span className="truncate">{col.label}</span>
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    col.visible
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'border-border bg-[#0B0F17]'
                  }`}
                >
                  {col.visible && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
