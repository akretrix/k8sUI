import React, { useState } from 'react';
import { Plus, X, Server, Layers } from 'lucide-react';
import {
  cleanClusterName,
  getClusterMonogram,
  getEnvironmentVisuals,
} from '../../utils/clusterNames';

export interface OpenClusterWorkspace {
  id: string;
  name: string;
  environment?: string;
  tabCount: number;
  hasError?: boolean;
}

interface ClusterRailProps {
  openClusters: OpenClusterWorkspace[];
  activeClusterId?: string;
  onSelectCluster: (clusterId: string) => void;
  onCloseCluster: (clusterId: string) => void;
  onAddCluster: () => void;
}

export const ClusterRail: React.FC<ClusterRailProps> = ({
  openClusters,
  activeClusterId,
  onSelectCluster,
  onCloseCluster,
  onAddCluster,
}) => {
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);

  // If there are no open clusters or only 1 cluster, we still show the rail
  // so the user always has a clear visual anchor of which environment they are in!
  return (
    <aside
      className="w-16 bg-[#070A10]/95 border-r border-border/80 flex flex-col items-center py-3 select-none shrink-0 z-30 relative"
      aria-label="Active Clusters Workspace Rail"
    >
      {/* Cluster Icon Monograms List */}
      <div className="flex-1 w-full flex flex-col items-center space-y-3 overflow-y-auto no-scrollbar px-2">
        {openClusters.map((cluster) => {
          const isActive = cluster.id === activeClusterId;
          const visuals = getEnvironmentVisuals(cluster.environment);
          const monogram = getClusterMonogram(cluster.name);
          const cleanName = cleanClusterName(cluster.name);
          const isHovered = hoveredClusterId === cluster.id;

          return (
            <div
              key={cluster.id}
              className="relative group w-full flex items-center justify-center"
              onMouseEnter={() => setHoveredClusterId(cluster.id)}
              onMouseLeave={() => setHoveredClusterId(null)}
            >
              {/* Active Indicator Bar (Left vertical pill like Slack/Discord) */}
              <div
                className={`absolute -left-2 w-1.5 rounded-r-full transition-all duration-300 ${
                  isActive
                    ? 'h-8 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                    : isHovered
                    ? 'h-4 bg-gray-500'
                    : 'h-0 bg-transparent'
                }`}
              />

              {/* Cluster Monogram Button */}
              <button
                type="button"
                onClick={() => onSelectCluster(cluster.id)}
                className={`relative w-11 h-11 rounded-xl transition-all duration-200 flex flex-col items-center justify-center border font-mono font-bold tracking-tight shadow-md ${
                  isActive
                    ? `${visuals.activeRingClass} scale-105`
                    : `${visuals.ringClass} hover:scale-102 hover:bg-surface/80 opacity-80 hover:opacity-100`
                }`}
                title={`${cleanName} (${visuals.label})`}
              >
                {/* 4-Letter Monogram */}
                <span className={`text-[11px] leading-tight tracking-wider ${visuals.textColor}`}>
                  {monogram}
                </span>

                {/* Environment Mini Label Subtext */}
                <span
                  className={`text-[8px] font-semibold tracking-tighter uppercase px-1 rounded-sm mt-0.5 ${
                    isActive ? 'bg-black/60 text-white' : 'text-gray-400'
                  }`}
                >
                  {visuals.label}
                </span>

                {/* Health / Error Dot */}
                <span
                  className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[#070A10] ${
                    cluster.hasError
                      ? 'bg-red-500 animate-pulse'
                      : isActive
                      ? visuals.dotColor
                      : 'bg-emerald-500/80'
                  }`}
                />

                {/* Tab Count Badge */}
                {cluster.tabCount > 1 && (
                  <span className="absolute -bottom-1 -left-1 px-1 min-w-[14px] h-3.5 bg-gray-900 border border-gray-700 text-gray-300 text-[8px] rounded-full flex items-center justify-center font-mono">
                    {cluster.tabCount}
                  </span>
                )}
              </button>

              {/* Rich Flyout Tooltip / Card on Hover */}
              {isHovered && (
                <div className="absolute left-14 top-1/2 -translate-y-1/2 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                  <div className="pointer-events-auto bg-[#0E131F] border border-gray-700/80 rounded-xl p-2.5 shadow-2xl min-w-[200px] max-w-[260px] text-left">
                    <div className="flex items-center justify-between space-x-2 border-b border-gray-800 pb-1.5 mb-1.5">
                      <div className="flex items-center space-x-1.5">
                        <Server className={`w-3.5 h-3.5 ${visuals.textColor}`} />
                        <span className="text-xs font-semibold text-white truncate max-w-[140px]">
                          {cleanName}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border ${visuals.badgeClass}`}
                      >
                        {visuals.label}
                      </span>
                    </div>

                    <div className="text-[10px] text-gray-400 flex items-center justify-between mb-2">
                      <span className="flex items-center space-x-1">
                        <Layers className="w-3 h-3 text-gray-500" />
                        <span>{cluster.tabCount} open {cluster.tabCount === 1 ? 'tab' : 'tabs'}</span>
                      </span>
                      {isActive && (
                        <span className="text-cyan-400 font-medium text-[10px]">Active</span>
                      )}
                    </div>

                    {/* Quick Close Workspace Button */}
                    {openClusters.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseCluster(cluster.id);
                        }}
                        className="w-full mt-1 px-2 py-1 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-[10px] flex items-center justify-center space-x-1 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        <span>Close Workspace</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add / Connect Another Cluster Button */}
        <div className="pt-2 w-full flex justify-center border-t border-border/40">
          <button
            type="button"
            onClick={onAddCluster}
            className="w-10 h-10 rounded-xl bg-surface/60 hover:bg-cyan-950/40 border border-dashed border-gray-700 hover:border-cyan-500/60 text-gray-400 hover:text-cyan-300 flex items-center justify-center transition-all duration-200 group"
            title="Open / Connect Another Cluster in a New Tab"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>
    </aside>
  );
};
