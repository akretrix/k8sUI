import React from 'react';
import { X, Download, ExternalLink, CheckCircle2, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { UpdateInfo, openDownloadLink, detectUserPlatform } from '../../utils/updateChecker';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo | null;
  isChecking: boolean;
  onCheckAgain: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  isChecking,
  onCheckAgain,
}) => {
  if (!isOpen) return null;

  const { platform } = detectUserPlatform();
  const recommended = updateInfo?.recommendedAsset;

  const platformName =
    platform === 'macos' ? 'macOS' : platform === 'windows' ? 'Windows' : platform === 'linux' ? 'Linux' : 'Desktop';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-elevated">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
              {isChecking ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : updateInfo?.hasUpdate ? (
                <Sparkles className="w-5 h-5 text-cyan-400" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {isChecking
                  ? 'Checking for Updates...'
                  : updateInfo?.hasUpdate
                  ? 'k8sUI Update Available'
                  : 'Up to Date'}
              </h2>
              <p className="text-xs text-gray-400">
                {isChecking
                  ? 'Querying official AkreTrix GitHub releases'
                  : updateInfo?.hasUpdate
                  ? `Version ${updateInfo.latestVersion} is ready to download`
                  : `k8sUI v${updateInfo?.currentVersion || '0.1.1'} is the latest version`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {isChecking ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
              <p className="text-sm text-gray-300">Checking for new releases on GitHub...</p>
            </div>
          ) : updateInfo?.hasUpdate ? (
            <>
              {/* Version Comparison Chip */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated border border-border">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-400">Installed:</span>
                  <span className="text-xs font-mono font-semibold text-gray-300">v{updateInfo.currentVersion}</span>
                </div>
                <div className="text-gray-500">→</div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-cyan-400 font-medium">Newest:</span>
                  <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                    v{updateInfo.latestVersion}
                  </span>
                </div>
              </div>

              {/* Release Notes */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  What's New in {updateInfo.releaseName}
                </h3>
                <div className="p-3.5 rounded-lg bg-black/40 border border-border/80 text-xs text-gray-300 font-sans leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {updateInfo.releaseNotes}
                </div>
              </div>

              {/* macOS Quarantine Helper Tip */}
              {platform === 'macos' && (
                <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-500/20 flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-blue-200/90 leading-normal">
                    <strong>macOS Gatekeeper tip:</strong> If macOS shows a warning for open-source apps, run{' '}
                    <code className="bg-black/50 px-1 py-0.5 rounded text-cyan-300 font-mono">
                      xattr -cr /Applications/k8s-ui.app
                    </code>{' '}
                    in Terminal to clear the download quarantine flag.
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">You're up to date!</h3>
                <p className="text-xs text-gray-400 mt-1">
                  You are running k8sUI v{updateInfo?.currentVersion || '0.1.1'}. No updates are available at this time.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-surface-elevated flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCheckAgain}
            disabled={isChecking}
            className="text-xs text-gray-400 hover:text-white transition-colors flex items-center space-x-1.5 py-2 px-2.5 rounded hover:bg-surface"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Check again</span>
          </button>

          <div className="flex items-center space-x-2">
            {updateInfo?.hasUpdate && recommended ? (
              <button
                type="button"
                onClick={() => openDownloadLink(recommended.browser_download_url)}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-brand-500 hover:bg-brand-400 text-white font-medium text-xs rounded-lg transition-all shadow-lg shadow-brand-500/20 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download for {platformName} ({(recommended.size / (1024 * 1024)).toFixed(1)} MB)</span>
              </button>
            ) : null}

            {updateInfo?.hasUpdate ? (
              <button
                type="button"
                onClick={() => openDownloadLink(updateInfo.releaseUrl)}
                className="flex items-center space-x-1.5 px-3 py-2 bg-surface hover:bg-surface-elevated border border-border text-gray-300 hover:text-white text-xs rounded-lg transition-colors cursor-pointer"
              >
                <span>GitHub</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-surface hover:bg-surface-elevated border border-border text-gray-300 hover:text-white text-xs rounded-lg transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
