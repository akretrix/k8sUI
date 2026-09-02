import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/tauriClient';
import { SsoSessionEntry } from '../../types/cluster';
import {
  ShieldCheck,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  X,
  Globe,
  Radio,
} from 'lucide-react';

interface AwsSsoModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusterName?: string;
  detectedProfile?: string;
  onAuthSuccess?: () => void;
}

export const AwsSsoModal: React.FC<AwsSsoModalProps> = ({
  isOpen,
  onClose,
  clusterName,
  detectedProfile,
  onAuthSuccess,
}) => {
  const [selectedSessionName, setSelectedSessionName] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery<SsoSessionEntry[]>({
    queryKey: ['aws_sso_sessions'],
    queryFn: () => api.listAwsSsoSessions(),
    enabled: isOpen,
  });

  // Automatically select matching session or first session
  useEffect(() => {
    if (sessions.length > 0) {
      if (!selectedSessionName) {
        const match = sessions.find(
          (s) =>
            s.session_name === detectedProfile ||
            s.matching_profiles.some((p) => p === detectedProfile)
        );
        if (match) {
          setSelectedSessionName(match.session_name);
        } else {
          setSelectedSessionName(sessions[0].session_name);
        }
      }
    }
  }, [sessions, detectedProfile, selectedSessionName]);

  if (!isOpen) return null;

  const currentSession =
    sessions.find((s) => s.session_name === selectedSessionName) || sessions[0];

  const handleCancelOrClose = () => {
    setIsAuthenticating(false);
    setAuthError(null);
    setAuthSuccessMsg(null);
    onClose();
  };

  const handleStartAuth = async () => {
    const targetSession = selectedSessionName || currentSession?.session_name;
    if (!targetSession) return;

    setIsAuthenticating(true);
    setAuthError(null);
    setAuthSuccessMsg(null);

    try {
      const res = await api.awsSsoLogin({
        sessionName: targetSession,
      });

      setAuthSuccessMsg(res || 'Authentication successful!');
      if (onAuthSuccess) {
        onAuthSuccess();
      }
      setTimeout(() => {
        setIsAuthenticating(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      setAuthError(err?.message || String(err));
      setIsAuthenticating(false);
    }
  };

  const handleCopyCmd = async () => {
    const session = selectedSessionName || currentSession?.session_name || detectedProfile || 'default';
    const cmd = `aws sso login --sso-session ${session}`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0E131F] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-[#141A29]/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">AWS SSO Browser Authentication</h3>
              <p className="text-xs text-gray-400">
                {clusterName ? `Authorize access for cluster '${clusterName}'` : 'Sign in via AWS Identity Center'}
              </p>
            </div>
          </div>
          <button
            onClick={handleCancelOrClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Status Notifications */}
          {authSuccessMsg && (
            <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center space-x-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{authSuccessMsg}</span>
            </div>
          )}

          {authError && (
            <div className="p-3.5 bg-rose-950/80 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-center space-x-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="break-all">{authError}</span>
            </div>
          )}

          {/* Session Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Select AWS SSO Session
            </label>

            {isLoadingSessions ? (
              <div className="flex items-center justify-center p-6 text-gray-400 space-x-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Reading ~/.aws/config…</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-4 bg-gray-900/80 border border-gray-800 rounded-xl text-xs text-gray-400">
                No <code>[sso-session]</code> sections found in your <code>~/.aws/config</code>.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {sessions.map((sess) => {
                  const isSelected = sess.session_name === (selectedSessionName || currentSession?.session_name);
                  return (
                    <div
                      key={sess.session_name}
                      onClick={() => {
                        setSelectedSessionName(sess.session_name);
                        setAuthError(null);
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-500/60 ring-1 ring-cyan-500/40 shadow-sm shadow-cyan-950'
                          : 'bg-gray-900/50 border-gray-800/80 hover:border-gray-700 hover:bg-gray-800/40'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="mt-0.5">
                          <Radio
                            className={`w-4 h-4 ${
                              isSelected ? 'text-cyan-400 fill-cyan-400' : 'text-gray-600'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-white">{sess.session_name}</span>
                            {sess.matching_profiles.some((p) => p === detectedProfile) && (
                              <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded text-[10px] font-mono">
                                Cluster Match
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-gray-400 mt-0.5">
                            <Globe className="w-3 h-3 text-gray-500 shrink-0" />
                            <span className="truncate max-w-[260px] font-mono text-[11px]">
                              {sess.start_url}
                            </span>
                            <span className="text-gray-600">•</span>
                            <span className="text-gray-500 text-[11px] font-mono">{sess.sso_region}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Direct Browser Explanation */}
          <div className="p-3.5 bg-[#141A29]/80 border border-gray-800 rounded-xl text-xs text-gray-300 space-y-1.5">
            <div className="font-semibold text-gray-200 flex items-center space-x-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span>How this works:</span>
            </div>
            <p className="text-gray-400 leading-relaxed text-[11px]">
              Clicking below will pop open your browser directly to{' '}
              <span className="font-mono text-cyan-300">
                {currentSession?.start_url || 'AWS SSO'}
              </span>
              . Once you click <b>"Allow"</b> in your browser, this app captures the authorization token and reconnects your cluster automatically.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800/80 bg-[#141A29]/60">
          <button
            onClick={handleCopyCmd}
            className="text-xs text-gray-400 hover:text-gray-200 font-mono flex items-center space-x-1 px-2.5 py-1.5 rounded-lg hover:bg-gray-800/60 transition-colors"
            title="Copy command to clipboard"
          >
            {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCmd ? 'Command Copied!' : 'Copy CLI Command'}</span>
          </button>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleCancelOrClose}
              className="px-4 py-2 text-xs font-medium text-gray-300 hover:text-white rounded-xl hover:bg-gray-800/80 transition-colors"
            >
              {isAuthenticating ? 'Cancel Auth' : 'Cancel'}
            </button>
            <button
              onClick={handleStartAuth}
              disabled={isAuthenticating || (!selectedSessionName && !currentSession)}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-black font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center space-x-2 transition-all disabled:opacity-50"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Waiting for browser approval…</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 text-black" />
                  <span>
                    Authenticate {selectedSessionName ? `'${selectedSessionName}'` : ''} in Browser
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
