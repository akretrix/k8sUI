import React from 'react';
import { LogoSymbol } from './LogoSymbol';

export const MultiplatformMockups: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* 1. Web Favicon & Browser Tab Preview */}
      <div className="p-5 rounded-2xl bg-canvas-surface border border-canvas-subdued flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400 font-mono">
              Web / PWA Favicon
            </span>
            <span className="text-[11px] font-mono text-gray-400">16x16 · 32x32</span>
          </div>
          {/* Browser Tab Shell */}
          <div className="bg-[#161F30] rounded-xl border border-gray-800 overflow-hidden shadow-inner">
            <div className="bg-[#0B0F17] px-3 py-2 border-b border-gray-800 flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              <div className="ml-2 px-2.5 py-1 bg-[#161F30] rounded-t-md flex items-center space-x-1.5 text-xs text-gray-200 border-t border-x border-gray-700 max-w-[140px] truncate">
                <img src="/favicon.svg" alt="favicon" className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate text-[11px]">K8SUI · Dashboard</span>
              </div>
            </div>
            <div className="p-4 bg-[#0B0F17] flex items-center justify-around">
              <div className="flex flex-col items-center space-y-1">
                <img src="/favicon.svg" alt="16" className="w-4 h-4" />
                <span className="text-[10px] font-mono text-gray-400">16px</span>
              </div>
              <div className="flex flex-col items-center space-y-1">
                <img src="/favicon.svg" alt="32" className="w-8 h-8" />
                <span className="text-[10px] font-mono text-gray-400">32px</span>
              </div>
              <div className="flex flex-col items-center space-y-1">
                <img src="/favicon.svg" alt="64" className="w-12 h-12" />
                <span className="text-[10px] font-mono text-gray-400">64px SVG</span>
              </div>
            </div>
          </div>
        </div>
        <div className="text-[11px] text-gray-400">
          Clean vector favicon with active cluster green indicator for crisp high-DPI rendering.
        </div>
      </div>

      {/* 2. macOS / Windows Desktop Dock Icon */}
      <div className="p-5 rounded-2xl bg-canvas-surface border border-canvas-subdued flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400 font-mono">
              Desktop Dock Icon
            </span>
            <span className="text-[11px] font-mono text-gray-400">macOS / Win</span>
          </div>
          {/* Dock Canvas */}
          <div className="py-6 px-4 bg-gradient-to-b from-[#0B0F17] to-[#161F30] rounded-xl border border-gray-800 flex items-center justify-center relative overflow-hidden">
            <div className="w-24 h-24 rounded-[22px] bg-gradient-to-br from-[#1E293B] via-[#0B0F17] to-[#06090E] border-2 border-brand-500/40 shadow-2xl shadow-brand-500/20 flex items-center justify-center p-2 relative group hover:scale-105 transition-transform">
              <LogoSymbol size={76} hasGlow />
              <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-white/60" />
            </div>
          </div>
        </div>
        <div className="text-[11px] text-gray-400">
          Continuous curvature squircle with 8% inner gradient glow matching macOS HIG.
        </div>
      </div>

      {/* 3. iOS App Icon (1024x1024 Master Canvas) */}
      <div className="p-5 rounded-2xl bg-canvas-surface border border-canvas-subdued flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400 font-mono">
              iOS Master Icon
            </span>
            <span className="text-[11px] font-mono text-gray-400">1024x1024 Master</span>
          </div>
          {/* iOS Springboard Preview */}
          <div className="py-6 px-4 bg-[#0B0F17] rounded-xl border border-gray-800 flex flex-col items-center justify-center space-y-2">
            <div className="w-20 h-20 rounded-[20px] bg-gradient-to-br from-[#161F30] to-[#0B0F17] border border-brand-500/30 flex items-center justify-center p-2 shadow-lg shadow-black">
              <LogoSymbol size={64} hasGlow />
            </div>
            <span className="text-xs font-mono font-medium text-gray-200">K8SUI</span>
          </div>
        </div>
        <div className="text-[11px] text-gray-400">
          No transparency, solid dark obsidian gradient with centered 1024px safe-zone geometry.
        </div>
      </div>

      {/* 4. Android Adaptive Icon (Foreground + Background Mesh) */}
      <div className="p-5 rounded-2xl bg-canvas-surface border border-canvas-subdued flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400 font-mono">
              Android Adaptive
            </span>
            <span className="text-[11px] font-mono text-gray-400">Foreground + Mesh</span>
          </div>
          {/* Adaptive Layer Split Preview */}
          <div className="py-4 px-3 bg-[#0B0F17] rounded-xl border border-gray-800 flex items-center justify-around">
            <div className="flex flex-col items-center space-y-1">
              <div className="w-14 h-14 rounded-full bg-[#111827] border border-gray-700 flex items-center justify-center relative overflow-hidden">
                {/* Background Mesh */}
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#326CE5_1px,transparent_1px)] [background-size:8px_8px]" />
                <span className="text-[9px] text-gray-400 font-mono relative">Background</span>
              </div>
              <span className="text-[10px] text-gray-400">Layer 1</span>
            </div>
            <span className="text-gray-500 text-lg">+</span>
            <div className="flex flex-col items-center space-y-1">
              <div className="w-14 h-14 rounded-full bg-transparent border border-dashed border-brand-500/50 flex items-center justify-center">
                <LogoSymbol size={40} hasGlow={false} />
              </div>
              <span className="text-[10px] text-gray-400">Foreground</span>
            </div>
          </div>
        </div>
        <div className="text-[11px] text-gray-400">
          Modular foreground layer with parallax-ready parallax safe margins on Android 14+.
        </div>
      </div>
    </div>
  );
};
