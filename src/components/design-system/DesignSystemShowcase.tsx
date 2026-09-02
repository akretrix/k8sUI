import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Palette,
  Sparkles,
  Smartphone,
  Layers,
  Code2,
  Moon,
  Sun,
} from 'lucide-react';
import { LogoSymbol } from '../../assets/brand/LogoSymbol';
import { LogoLockup } from '../../assets/brand/LogoLockup';
import { LogoMonochrome } from '../../assets/brand/LogoMonochrome';
import {
  NoClustersIllustration,
  CrashAlertIllustration,
  RollingUpdateIllustration,
  AllSystemsOperationalIllustration,
} from '../../assets/brand/EmptyStateIllustrations';
import { MultiplatformMockups } from '../../assets/brand/MultiplatformMockups';

interface DesignSystemShowcaseProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'colors' | 'logos' | 'icons' | 'illustrations' | 'code';

export const DesignSystemShowcase: React.FC<DesignSystemShowcaseProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('colors');
  const [previewTheme, setPreviewTheme] = useState<'dark' | 'light'>('dark');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [symbolScale, setSymbolScale] = useState<number>(64);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const primaryColors = [
    { name: 'Primary 50', hex: '#EEF4FF', desc: 'Subtle tint / Light hover' },
    { name: 'Primary 100', hex: '#DCE7FE', desc: 'Badge background' },
    { name: 'Primary 200', hex: '#B8D0FC', desc: 'Border accent light' },
    { name: 'Primary 300', hex: '#8FB4FA', desc: 'Highlight link light' },
    { name: 'Primary 400', hex: '#60A5FA', desc: 'Interactive focus ring' },
    { name: 'Primary 500', hex: '#326CE5', desc: 'Brand Core (K8s Inspired)', isCore: true },
    { name: 'Primary 600', hex: '#2557C7', desc: 'Button hover state' },
    { name: 'Primary 700', hex: '#1D44A5', desc: 'Active pressed state' },
    { name: 'Primary 800', hex: '#143175', desc: 'Deep background mesh' },
    { name: 'Primary 900', hex: '#0E214F', desc: 'Obsidian tint base' },
  ];

  const canvasColors = [
    { name: 'Canvas Base', hex: '#0B0F17', desc: 'Deep Obsidian Background' },
    { name: 'Surface Card', hex: '#111827', desc: 'Slate 900 Card Surface' },
    { name: 'Surface Elevated', hex: '#1F2937', desc: 'Slate 800 Toolbar / Modals' },
    { name: 'Border Subdued', hex: '#1F2937', desc: 'Subtle separator' },
    { name: 'Text Primary', hex: '#F9FAFB', desc: 'Main UI typography' },
    { name: 'Text Muted', hex: '#9CA3AF', desc: 'Secondary labels / metadata' },
  ];

  const semanticColors = [
    { name: 'Healthy / Active', hex: '#10B981', pulse: '#34D399', desc: 'Running pods, healthy cluster' },
    { name: 'Warning / Degraded', hex: '#F59E0B', desc: 'Pending pods, high CPU usage' },
    { name: 'Critical / CrashLoop', hex: '#EF4444', desc: 'CrashLoopBackOff, OOMKilled' },
    { name: 'Pending / Provisioning', hex: '#6366F1', desc: 'Scaling, rollout transitions' },
  ];

  const rawSvgSymbol = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <polygon points="256,92 398,174 398,338 256,420 114,338 114,174" stroke="#326CE5" stroke-width="3" stroke-dasharray="10 8"/>
  <g stroke="#326CE5" stroke-width="2.5"><line x1="256" y1="92" x2="256" y2="150"/><line x1="398" y1="174" x2="348" y2="203"/><line x1="398" y1="338" x2="348" y2="309"/><line x1="256" y1="420" x2="256" y2="362"/><line x1="114" y1="338" x2="164" y2="309"/><line x1="114" y1="174" x2="164" y2="203"/></g>
  <polygon points="256,150 348,203 256,256 164,203" fill="#60A5FA" stroke="#93C5FD" stroke-width="2.5"/>
  <polygon points="164,203 256,256 256,362 164,309" fill="#326CE5" stroke="#326CE5" stroke-width="2.5"/>
  <polygon points="256,256 348,203 348,309 256,362" fill="#2557C7" stroke="#2557C7" stroke-width="2.5"/>
  <circle cx="398" cy="174" r="16" fill="#0B0F17" stroke="#10B981" stroke-width="4"/>
  <circle cx="398" cy="174" r="7" fill="#34D399"/>
  <circle cx="256" cy="203" r="16" fill="#326CE5"/>
  <circle cx="256" cy="203" r="6" fill="#FFFFFF"/>
</svg>`;

  const cssTokensSnippet = `:root {
  /* Brand Core (K8s Inspired) */
  --brand-50: #EEF4FF;
  --brand-100: #DCE7FE;
  --brand-500: #326CE5;
  --brand-600: #2557C7;
  --brand-700: #1D44A5;

  /* Neutral Canvas */
  --canvas-base: #0B0F17;
  --canvas-surface: #111827;
  --canvas-elevated: #1F2937;
  --border-subdued: #1F2937;
  --text-primary: #F9FAFB;
  --text-muted: #9CA3AF;

  /* Semantic Status */
  --semantic-healthy: #10B981;
  --semantic-warning: #F59E0B;
  --semantic-critical: #EF4444;
  --semantic-pending: #6366F1;
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 md:p-6 overflow-hidden">
      <div className="w-full max-w-7xl h-full max-h-[92vh] bg-canvas-base border border-canvas-subdued rounded-2xl shadow-2xl flex flex-col overflow-hidden text-gray-100 font-sans">
        {/* Top Header */}
        <div className="h-16 border-b border-canvas-subdued px-6 flex items-center justify-between bg-canvas-surface shrink-0">
          <div className="flex items-center space-x-3">
            <LogoLockup symbolSize={32} showSubtitle={false} />
            <div className="h-4 w-px bg-gray-700 mx-2 hidden sm:block" />
            <span className="text-xs font-mono uppercase tracking-widest text-brand-400 font-semibold hidden sm:inline">
              Multiplatform Design System & Asset Suite
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {/* Dark / Light Preview Toggle */}
            <div className="flex items-center bg-canvas-elevated rounded-lg p-0.5 border border-gray-700">
              <button
                onClick={() => setPreviewTheme('dark')}
                className={`p-1.5 rounded-md transition-colors ${
                  previewTheme === 'dark' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
                title="Dark Mode Preview"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPreviewTheme('light')}
                className={`p-1.5 rounded-md transition-colors ${
                  previewTheme === 'light' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
                title="Light Mode Preview"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-canvas-elevated text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="h-12 border-b border-canvas-subdued px-6 flex items-center space-x-6 bg-canvas-surface/70 shrink-0 overflow-x-auto">
          {[
            { id: 'colors', label: 'Brand & Semantic Colors', icon: Palette },
            { id: 'logos', label: 'Logo & Wordmark Suite', icon: Sparkles },
            { id: 'icons', label: 'Multiplatform App Icons', icon: Smartphone },
            { id: 'illustrations', label: 'State Illustrations', icon: Layers },
            { id: 'code', label: 'Code & CSS Tokens', icon: Code2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center space-x-2 text-xs font-semibold h-full border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-brand-500 text-brand-300'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Content Body */}
        <div
          className={`flex-1 overflow-y-auto p-6 md:p-8 ${
            previewTheme === 'light' ? 'bg-gray-100 text-gray-900' : 'bg-canvas-base text-gray-100'
          } transition-colors`}
        >
          {/* TAB 1: BRAND COLORS & SEMANTIC TOKENS */}
          {activeTab === 'colors' && (
            <div className="space-y-8 max-w-6xl mx-auto">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400 font-mono mb-2">
                  1. Primary Brand Palette (Kubernetes Inspired Core)
                </h3>
                <p className={`text-xs ${previewTheme === 'light' ? 'text-gray-600' : 'text-gray-400'} mb-4`}>
                  Distinctive, vibrant blue hues crafted for high-contrast cluster control planes without CNCF trademark conflict.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {primaryColors.map((color) => (
                    <div
                      key={color.hex}
                      onClick={() => copyToClipboard(color.hex, color.name)}
                      className={`p-3 rounded-xl border cursor-pointer group transition-all hover:scale-[1.02] shadow-sm ${
                        previewTheme === 'light'
                          ? 'bg-white border-gray-200 shadow-gray-200'
                          : 'bg-canvas-surface border-canvas-subdued hover:border-brand-500/50'
                      }`}
                    >
                      <div
                        className="h-16 rounded-lg mb-2.5 flex items-end justify-end p-2 relative shadow-inner"
                        style={{ backgroundColor: color.hex }}
                      >
                        {color.isCore && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white text-brand-700 shadow">
                            Core
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${previewTheme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                          {color.name}
                        </span>
                        {copiedKey === color.name ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity" />
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-gray-400 mt-0.5">{color.hex}</div>
                      <div className="text-[10px] text-gray-500 mt-1 line-clamp-1">{color.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Canvas Base Palette */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400 font-mono mb-2">
                  2. Neutral Canvas Tokens (Dark Mode Default)
                </h3>
                <p className={`text-xs ${previewTheme === 'light' ? 'text-gray-600' : 'text-gray-400'} mb-4`}>
                  Deep obsidian and slate gradients calibrated for prolonged terminal & workload monitoring with zero eye-strain.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {canvasColors.map((color) => (
                    <div
                      key={color.name}
                      onClick={() => copyToClipboard(color.hex, color.name)}
                      className={`p-3 rounded-xl border cursor-pointer group transition-all hover:scale-[1.02] shadow-sm ${
                        previewTheme === 'light'
                          ? 'bg-white border-gray-200 shadow-gray-200'
                          : 'bg-canvas-surface border-canvas-subdued hover:border-brand-500/50'
                      }`}
                    >
                      <div
                        className="h-14 rounded-lg mb-2.5 border border-gray-700/50 shadow-inner"
                        style={{ backgroundColor: color.hex }}
                      />
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${previewTheme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                          {color.name}
                        </span>
                        {copiedKey === color.name ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity" />
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-gray-400 mt-0.5">{color.hex}</div>
                      <div className="text-[10px] text-gray-500 mt-1 line-clamp-1">{color.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Semantic Status Colors */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400 font-mono mb-2">
                  3. Semantic Kubernetes Status Indicators
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {semanticColors.map((color) => (
                    <div
                      key={color.hex}
                      onClick={() => copyToClipboard(color.hex, color.name)}
                      className={`p-4 rounded-xl border cursor-pointer group transition-all hover:scale-[1.02] shadow-sm ${
                        previewTheme === 'light'
                          ? 'bg-white border-gray-200 shadow-gray-200'
                          : 'bg-canvas-surface border-canvas-subdued hover:border-brand-500/50'
                      }`}
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shadow-md"
                          style={{ backgroundColor: color.hex }}
                        >
                          <div className="w-3 h-3 rounded-full bg-white/80" />
                        </div>
                        <div>
                          <div className={`text-xs font-bold ${previewTheme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                            {color.name}
                          </div>
                          <div className="text-[11px] font-mono text-gray-400">{color.hex}</div>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-400">{color.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOGO & WORDMARK SUITE */}
          {activeTab === 'logos' && (
            <div className="space-y-8 max-w-6xl mx-auto">
              {/* Scaler Toolbar */}
              <div className="p-4 rounded-xl bg-canvas-surface border border-canvas-subdued flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-semibold text-gray-300 font-mono">Live Scale Preview:</span>
                  <input
                    type="range"
                    min="32"
                    max="160"
                    value={symbolScale}
                    onChange={(e) => setSymbolScale(Number(e.target.value))}
                    className="w-36 accent-brand-500"
                  />
                  <span className="text-xs font-mono text-brand-400 font-bold">{symbolScale}px</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => copyToClipboard(rawSvgSymbol, 'svg-symbol')}
                    className="px-3 py-1.5 rounded-lg bg-canvas-elevated hover:bg-surface-hover border border-gray-700 text-xs font-medium text-gray-200 flex items-center space-x-1.5"
                  >
                    {copiedKey === 'svg-symbol' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy Raw SVG</span>
                  </button>
                </div>
              </div>

              {/* Logo Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Full Horizontal Lockup */}
                <div className="p-6 rounded-2xl bg-canvas-surface border border-canvas-subdued flex flex-col justify-between space-y-6">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand-400 font-mono block mb-1">
                      1. Full Horizontal Lockup
                    </span>
                    <p className="text-[11px] text-gray-400">Primary header & splash branding lockup.</p>
                  </div>
                  <div className="py-8 px-4 bg-canvas-base rounded-xl border border-gray-800 flex items-center justify-center">
                    <LogoLockup symbolSize={symbolScale} theme={previewTheme} />
                  </div>
                  <div className="text-[11px] font-mono text-gray-400 text-center">
                    Symbol + Wordmark + UI Pill
                  </div>
                </div>

                {/* 2. Compact Symbol Only (1:1) */}
                <div className="p-6 rounded-2xl bg-canvas-surface border border-canvas-subdued flex flex-col justify-between space-y-6">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand-400 font-mono block mb-1">
                      2. Compact Symbol (1:1)
                    </span>
                    <p className="text-[11px] text-gray-400">App icons, mobile headers, and favicons.</p>
                  </div>
                  <div className="py-8 px-4 bg-canvas-base rounded-xl border border-gray-800 flex items-center justify-center">
                    <LogoSymbol size={symbolScale} hasGlow />
                  </div>
                  <div className="text-[11px] font-mono text-gray-400 text-center">
                    Isometric Hex Cube + Active Pod Core
                  </div>
                </div>

                {/* 3. Monochrome Stroke Version */}
                <div className="p-6 rounded-2xl bg-canvas-surface border border-canvas-subdued flex flex-col justify-between space-y-6">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand-400 font-mono block mb-1">
                      3. Monochrome Stroke
                    </span>
                    <p className="text-[11px] text-gray-400">High contrast, CLI, and monochrome prints.</p>
                  </div>
                  <div className="py-8 px-4 bg-canvas-base rounded-xl border border-gray-800 flex items-center justify-center">
                    <LogoMonochrome size={symbolScale} color={previewTheme === 'light' ? '#000000' : '#FFFFFF'} />
                  </div>
                  <div className="text-[11px] font-mono text-gray-400 text-center">
                    Vector Stroke Outline
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MULTIPLATFORM APP ICONS */}
          {activeTab === 'icons' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400 font-mono mb-1">
                  Multiplatform Desktop, Mobile & Web Icon Canvas Matrix
                </h3>
                <p className={`text-xs ${previewTheme === 'light' ? 'text-gray-600' : 'text-gray-400'} mb-6`}>
                  Tested against Apple Human Interface Guidelines (macOS squircle & iOS 1024), Android Adaptive specs, and Web PWA standards.
                </p>
              </div>
              <MultiplatformMockups />
            </div>
          )}

          {/* TAB 4: STATE ILLUSTRATIONS */}
          {activeTab === 'illustrations' && (
            <div className="space-y-8 max-w-6xl mx-auto">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-400 font-mono mb-1">
                  Supporting Infrastructure & Empty State Illustrations
                </h3>
                <p className={`text-xs ${previewTheme === 'light' ? 'text-gray-600' : 'text-gray-400'} mb-6`}>
                  Rich vector SVGs designed for common Kubernetes DevOps states.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. No Clusters */}
                <div className="p-6 rounded-2xl bg-canvas-surface border border-canvas-subdued flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-brand-400 font-mono">1. No Clusters Connected</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-mono">Empty State</span>
                  </div>
                  <div className="bg-canvas-base rounded-xl border border-gray-800 p-4 flex items-center justify-center">
                    <NoClustersIllustration size={220} />
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    Displayed when no kubeconfig context or AWS/Azure organization is active.
                  </p>
                </div>

                {/* 2. Crash Alert */}
                <div className="p-6 rounded-2xl bg-canvas-surface border border-canvas-subdued flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-red-400 font-mono">2. Pods Crashing / Alert State</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono">Incident State</span>
                  </div>
                  <div className="bg-canvas-base rounded-xl border border-gray-800 p-4 flex items-center justify-center">
                    <CrashAlertIllustration size={220} />
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    Used during CrashLoopBackOff, node degradation, and cluster alerts.
                  </p>
                </div>

                {/* 3. Rolling Update */}
                <div className="p-6 rounded-2xl bg-canvas-surface border border-canvas-subdued flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-cyan-400 font-mono">3. Deployment Rolling Update</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">Transition State</span>
                  </div>
                  <div className="bg-canvas-base rounded-xl border border-gray-800 p-4 flex items-center justify-center">
                    <RollingUpdateIllustration size={220} />
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    Used during zero-downtime rolling updates, canary deploys, and scaling events.
                  </p>
                </div>

                {/* 4. All Systems Operational */}
                <div className="p-6 rounded-2xl bg-canvas-surface border border-canvas-subdued flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 font-mono">4. All Systems Operational</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">Healthy State</span>
                  </div>
                  <div className="bg-canvas-base rounded-xl border border-gray-800 p-4 flex items-center justify-center">
                    <AllSystemsOperationalIllustration size={220} />
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    Displayed when all node conditions are Ready and pods are in healthy status.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CODE & CSS TOKENS */}
          {activeTab === 'code' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div className="p-5 rounded-2xl bg-canvas-surface border border-canvas-subdued space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-400 font-mono">
                    CSS Custom Properties (:root Tokens)
                  </span>
                  <button
                    onClick={() => copyToClipboard(cssTokensSnippet, 'css-tokens')}
                    className="px-3 py-1.5 rounded-lg bg-canvas-elevated hover:bg-surface-hover border border-gray-700 text-xs font-medium text-gray-200 flex items-center space-x-1.5"
                  >
                    {copiedKey === 'css-tokens' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy CSS</span>
                  </button>
                </div>
                <pre className="p-4 bg-[#0A0A0C] border border-gray-800 rounded-xl font-mono text-xs text-brand-300 overflow-x-auto leading-relaxed">
                  {cssTokensSnippet}
                </pre>
              </div>

              <div className="p-5 rounded-2xl bg-canvas-surface border border-canvas-subdued space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-400 font-mono">
                    Raw SVG Vector Icon
                  </span>
                  <button
                    onClick={() => copyToClipboard(rawSvgSymbol, 'svg-raw')}
                    className="px-3 py-1.5 rounded-lg bg-canvas-elevated hover:bg-surface-hover border border-gray-700 text-xs font-medium text-gray-200 flex items-center space-x-1.5"
                  >
                    {copiedKey === 'svg-raw' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy SVG</span>
                  </button>
                </div>
                <pre className="p-4 bg-[#0A0A0C] border border-gray-800 rounded-xl font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed">
                  {rawSvgSymbol}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
