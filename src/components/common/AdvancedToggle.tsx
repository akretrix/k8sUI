import React from 'react';
import { SlidersHorizontal } from 'lucide-react';

interface AdvancedToggleProps {
  isAdvanced: boolean;
  onToggle: () => void;
}

export const AdvancedToggle: React.FC<AdvancedToggleProps> = ({ isAdvanced, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-mono border transition-colors ${
        isAdvanced
          ? 'border-indigo-500 bg-indigo-950/50 text-indigo-300'
          : 'border-border bg-surface text-gray-400 hover:text-white'
      }`}
      title="Toggle Progressive Disclosure: Raw YAML, Container Exec, Port-Forward"
    >
      <SlidersHorizontal className="w-3.5 h-3.5" />
      <span>{isAdvanced ? 'Advanced: ON' : 'Advanced: OFF'}</span>
    </button>
  );
};
