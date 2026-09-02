import React from 'react';
import { ClusterSwitcher } from '../cluster/ClusterSwitcher';
import { ReadOnlyToggle } from '../cluster/ReadOnlyToggle';
import { ClusterContextSummary, ClusterHealthInfo, ActivePortForward } from '../../types/cluster';
import { Bot, Search, SlidersHorizontal, Shield, Palette, Sparkles } from 'lucide-react';
import { LogoLockup } from '../../assets/brand/LogoLockup';
import { PortForwardGlobalWidget } from '../portforward/PortForwardGlobalWidget';

interface HeaderProps {
  clusters: ClusterContextSummary[];
  activeCluster: ClusterContextSummary | null;
  healthInfo?: ClusterHealthInfo | null;
  isHealthChecking?: boolean;
  isReadOnly: boolean;
  isAdvancedMode: boolean;
  isAiDrawerOpen: boolean;
  activePortForwards?: ActivePortForward[];
  onStopPortForward?: (sessionId: string) => void;
  onRefreshPortForwards?: () => void;
  onSelectCluster: (clusterId: string) => void;
  onOpenClusterInNewTab?: (cluster: ClusterContextSummary) => void;
  onToggleReadOnly: (enableWrite: boolean) => void;
  onToggleAdvancedMode: () => void;
  onOpenCommandPalette: () => void;
  onOpenAuditLog: () => void;
  onToggleAiDrawer: () => void;
  onOpenAddAwsOrg: () => void;
  onOpenDesignSystem?: () => void;
  onReconnect?: () => void;
  updateInfo?: any;
  onOpenUpdateModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  clusters,
  activeCluster,
  healthInfo,
  isHealthChecking,
  isReadOnly,
  isAdvancedMode,
  isAiDrawerOpen,
  activePortForwards = [],
  onStopPortForward = () => {},
  onRefreshPortForwards,
  onSelectCluster,
  onOpenClusterInNewTab,
  onToggleReadOnly,
  onToggleAdvancedMode,
  onOpenCommandPalette,
  onOpenAuditLog,
  onToggleAiDrawer,
  onOpenAddAwsOrg,
  onOpenDesignSystem,
  onReconnect,
  updateInfo,
  onOpenUpdateModal,
}) => {
  return (
    <header className="h-14 border-b border-border bg-surface/90 backdrop-blur px-4 flex items-center justify-between shrink-0 select-none z-30">
      {/* Left section: App Brand + Cluster Switcher */}
      <div className="flex items-center space-x-4">
        <div
          onClick={onOpenDesignSystem}
          className="cursor-pointer group flex items-center"
          title="Open Design System & Asset Suite"
        >
          <LogoLockup symbolSize={26} showSubtitle={false} />
        </div>

        <div className="h-4 w-px bg-border hidden sm:block" />

        <ClusterSwitcher
          clusters={clusters}
          activeCluster={activeCluster}
          healthInfo={healthInfo}
          isHealthChecking={isHealthChecking}
          onSelectCluster={onSelectCluster}
          onOpenClusterInNewTab={onOpenClusterInNewTab}
          onOpenAddAwsOrg={onOpenAddAwsOrg}
          onReconnect={onReconnect}
        />
      </div>

      {/* Center: Command Palette Trigger */}
      <button
        onClick={onOpenCommandPalette}
        className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-border bg-surface-elevated/60 text-xs text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors w-72 justify-between"
      >
        <span className="flex items-center space-x-2">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <span>Search pods, clusters...</span>
        </span>
        <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface border border-border rounded text-gray-400">
          ⌘K
        </kbd>
      </button>

      {/* Right Controls */}
      <div className="flex items-center space-x-2">
        {updateInfo?.hasUpdate && (
          <button
            onClick={onOpenUpdateModal}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-all shadow-sm shadow-cyan-950 animate-pulse cursor-pointer"
            title={`Update Available: v${updateInfo.latestVersion}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">v{updateInfo.latestVersion} Available</span>
          </button>
        )}

        {onOpenDesignSystem && (
          <button
            onClick={onOpenDesignSystem}
            className="p-2 rounded-md border border-border text-brand-400 hover:text-white hover:bg-surface-elevated transition-colors"
            title="Design System & Asset Suite"
          >
            <Palette className="w-4 h-4" />
          </button>
        )}

        <PortForwardGlobalWidget
          tunnels={activePortForwards}
          onStopTunnel={onStopPortForward}
          onRefresh={onRefreshPortForwards}
        />

        <ReadOnlyToggle
          isReadOnly={isReadOnly}
          environment={activeCluster?.environment}
          onToggle={onToggleReadOnly}
        />

        <button
          onClick={onToggleAdvancedMode}
          className={`p-2 rounded-md border text-xs transition-colors flex items-center space-x-1 ${
            isAdvancedMode
              ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300'
              : 'border-border text-gray-400 hover:text-gray-200 hover:bg-surface-elevated'
          }`}
          title="Toggle Advanced Mode (Raw YAML, Exec Terminal, Port-Forward)"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-[11px] hidden lg:inline-block">Advanced</span>
        </button>

        <button
          onClick={onOpenAuditLog}
          className="p-2 rounded-md border border-border text-gray-400 hover:text-gray-200 hover:bg-surface-elevated transition-colors"
          title="Local Audit Trail"
        >
          <Shield className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleAiDrawer}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
            isAiDrawerOpen
              ? 'border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-950'
              : 'border-indigo-500/50 bg-indigo-950/30 text-indigo-300 hover:bg-indigo-900/40'
          }`}
          title="Open AI Copilot"
        >
          <Bot className="w-4 h-4" />
          <span className="hidden sm:inline-block font-semibold">AI Copilot</span>
        </button>
      </div>
    </header>
  );
};
