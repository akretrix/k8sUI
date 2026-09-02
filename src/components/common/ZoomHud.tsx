import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ZoomHudProps {
  zoomLevel: number;
  showIndicator: boolean;
  onReset: () => void;
}

export const ZoomHud: React.FC<ZoomHudProps> = ({ zoomLevel, showIndicator, onReset }) => {
  if (!showIndicator) return null;

  const percentage = Math.round(zoomLevel * 100);
  const isDefault = percentage === 100;

  return (
    <div
      data-testid="zoom-hud"
      className="fixed bottom-6 right-6 z-50 animate-in fade-in zoom-in-95 duration-150 select-none pointer-events-auto"
    >
      <div className="bg-surface-elevated/95 backdrop-blur-md border border-border px-3.5 py-2 rounded-xl shadow-2xl flex items-center space-x-2.5 text-xs text-gray-200">
        {percentage > 100 ? (
          <ZoomIn className="w-4 h-4 text-brand-400 shrink-0" />
        ) : percentage < 100 ? (
          <ZoomOut className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <ZoomIn className="w-4 h-4 text-gray-400 shrink-0" />
        )}
        <div className="flex items-center space-x-1 font-mono font-semibold">
          <span className="text-gray-100">{percentage}%</span>
          <span className="text-[10px] text-gray-400 font-sans font-normal">(⌘ + scroll)</span>
        </div>
        {!isDefault && (
          <button
            onClick={onReset}
            title="Reset Zoom to 100% (⌘0)"
            className="ml-1 p-1 hover:bg-surface rounded text-gray-400 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
