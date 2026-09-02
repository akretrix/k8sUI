import React, { useState } from 'react';
import { Lock, Unlock, AlertTriangle } from 'lucide-react';
import { EnvironmentTier } from '../../types/cluster';

interface ReadOnlyToggleProps {
  isReadOnly: boolean;
  environment?: EnvironmentTier;
  onToggle: (enableWrite: boolean) => void;
}

export const ReadOnlyToggle: React.FC<ReadOnlyToggleProps> = ({
  isReadOnly,
  environment,
  onToggle,
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleToggleClick = () => {
    if (isReadOnly) {
      // Unlocking write access
      if (environment === 'Production') {
        setShowConfirmModal(true);
      } else {
        onToggle(true);
      }
    } else {
      // Re-locking to read-only
      onToggle(false);
    }
  };

  return (
    <>
      <button
        onClick={handleToggleClick}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-md border text-xs font-mono font-medium transition-all ${
          isReadOnly
            ? 'border-emerald-600/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40'
            : 'border-red-500 bg-red-950/60 text-red-300 hover:bg-red-900/70 animate-pulse'
        }`}
        title={isReadOnly ? 'Read-Only Mode Active (Safe)' : 'Write Mode Active (Mutating actions enabled)'}
        aria-label={isReadOnly ? 'Read-Only Mode Active' : 'Write Mode Active'}
      >
        {isReadOnly ? (
          <>
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>READ-ONLY</span>
          </>
        ) : (
          <>
            <Unlock className="w-3.5 h-3.5 text-red-400" />
            <span className="font-bold">WRITE-MODE</span>
          </>
        )}
      </button>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface-elevated border border-red-600/60 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Unlock Write Access to Production?</h3>
            </div>
            <p className="text-sm text-gray-300">
              You are attempting to enable mutating operations on a{' '}
              <span className="text-red-400 font-bold uppercase">Production</span> cluster. All mutating actions will still require server-side dry-run diff confirmation before applying.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-surface-hover border border-border"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  onToggle(true);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-950"
              >
                Unlock Write Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
