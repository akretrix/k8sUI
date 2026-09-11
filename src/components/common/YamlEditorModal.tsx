import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Pencil,
  Lock,
  Unlock,
  Search,
  ChevronUp,
  ChevronDown,
  GitCompare,
  FileCode,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../api/tauriClient';
import { DryRunResult } from '../../types/cluster';

export interface EditableResourceRef {
  kind: string;
  name: string;
  namespace?: string;
}

interface YamlEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: EditableResourceRef | null;
  isReadOnly: boolean;
  onApplied?: () => void;
}

export interface DiffLine {
  type: 'add' | 'remove' | 'same' | 'header' | 'collapse';
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  collapsedCount?: number;
}

/**
 * Computes a line-by-line diff between two YAML strings with support for
 * compact hunk folding (changes only + context).
 */
export function computeYamlDiff(
  before: string,
  after: string,
  compact: boolean = false
): {
  lines: DiffLine[];
  additions: number;
  deletions: number;
} {
  const a = before.split('\n');
  const b = after.split('\n');

  if (before === after) {
    return {
      lines: a.map((text, i) => ({
        type: 'same' as const,
        text,
        oldLineNumber: i + 1,
        newLineNumber: i + 1,
      })),
      additions: 0,
      deletions: 0,
    };
  }

  // Fast LCS table for diffing
  const maxLines = 3000;
  const aLines = a.slice(0, maxLines);
  const bLines = b.slice(0, maxLines);

  const dp: number[][] = Array.from({ length: aLines.length + 1 }, () =>
    new Array(bLines.length + 1).fill(0)
  );

  for (let i = aLines.length - 1; i >= 0; i--) {
    for (let j = bLines.length - 1; j >= 0; j--) {
      if (aLines[i] === bLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const rawLines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldNum = 1;
  let newNum = 1;
  let additions = 0;
  let deletions = 0;

  while (i < aLines.length && j < bLines.length) {
    if (aLines[i] === bLines[j]) {
      rawLines.push({
        type: 'same',
        text: aLines[i],
        oldLineNumber: oldNum++,
        newLineNumber: newNum++,
      });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rawLines.push({
        type: 'remove',
        text: aLines[i],
        oldLineNumber: oldNum++,
      });
      deletions++;
      i++;
    } else {
      rawLines.push({
        type: 'add',
        text: bLines[j],
        newLineNumber: newNum++,
      });
      additions++;
      j++;
    }
  }

  while (i < aLines.length) {
    rawLines.push({
      type: 'remove',
      text: aLines[i],
      oldLineNumber: oldNum++,
    });
    deletions++;
    i++;
  }

  while (j < bLines.length) {
    rawLines.push({
      type: 'add',
      text: bLines[j],
      newLineNumber: newNum++,
    });
    additions++;
    j++;
  }

  if (!compact || (additions === 0 && deletions === 0)) {
    return { lines: rawLines, additions, deletions };
  }

  // Compact mode: retain hunks containing changes plus 3 lines of surrounding context
  const contextLines = 3;
  const isChanged = rawLines.map((l) => l.type === 'add' || l.type === 'remove');
  const keep = new Array(rawLines.length).fill(false);

  for (let idx = 0; idx < rawLines.length; idx++) {
    if (isChanged[idx]) {
      const start = Math.max(0, idx - contextLines);
      const end = Math.min(rawLines.length - 1, idx + contextLines);
      for (let k = start; k <= end; k++) {
        keep[k] = true;
      }
    }
  }

  const compacted: DiffLine[] = [];
  let skipped = 0;

  for (let idx = 0; idx < rawLines.length; idx++) {
    if (keep[idx]) {
      if (skipped > 0) {
        compacted.push({
          type: 'collapse',
          text: `··· ${skipped} unchanged line${skipped > 1 ? 's' : ''} hidden ···`,
          collapsedCount: skipped,
        });
        skipped = 0;
      }
      compacted.push(rawLines[idx]);
    } else {
      skipped++;
    }
  }

  if (skipped > 0) {
    compacted.push({
      type: 'collapse',
      text: `··· ${skipped} unchanged line${skipped > 1 ? 's' : ''} hidden ···`,
      collapsedCount: skipped,
    });
  }

  return { lines: compacted, additions, deletions };
}

export const YamlEditorModal: React.FC<YamlEditorModalProps> = ({
  isOpen,
  onClose,
  resource,
  isReadOnly,
  onApplied,
}) => {
  const [step, setStep] = useState<'edit' | 'diff'>('edit');
  const [originalYaml, setOriginalYaml] = useState('');
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  // Search & Navigation
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Diff Options
  const [diffMode, setDiffMode] = useState<'compact' | 'full'>('compact');

  const isSecret = ['secret', 'secrets'].includes((resource?.kind || '').toLowerCase());
  const [secretMode, setSecretMode] = useState<'decoded' | 'raw'>('decoded');

  useEffect(() => {
    if (!isOpen || !resource) return;
    setStep('edit');
    setError(null);
    setDryRun(null);
    setLoading(true);
    setIsSearchOpen(false);
    setSearchQuery('');

    const fetchPromise =
      isSecret && secretMode === 'decoded' && typeof api.getSecretYamlDecoded === 'function'
        ? api.getSecretYamlDecoded(resource.name, resource.namespace)
        : api.getResourceYaml(resource.kind, resource.name, resource.namespace);

    fetchPromise
      .then((val) => {
        setYaml(val);
        setOriginalYaml(val);
      })
      .catch((e: any) => setError(e?.message || String(e)))
      .finally(() => setLoading(false));
  }, [isOpen, resource, isSecret, secretMode]);

  // Compute live diff between original live YAML and current editor state
  const localDiff = useMemo(() => {
    return computeYamlDiff(originalYaml, yaml, diffMode === 'compact');
  }, [originalYaml, yaml, diffMode]);

  const fullDiffStats = useMemo(() => {
    return computeYamlDiff(originalYaml, yaml, false);
  }, [originalYaml, yaml]);

  const hasModifications = yaml !== originalYaml;

  // Search Matches in editor text
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim() || !yaml) return [];
    const query = searchQuery.toLowerCase();
    const lower = yaml.toLowerCase();
    const matches: Array<{ start: number; end: number; line: number }> = [];

    const lines = yaml.split('\n');
    const lineOffsets: number[] = [];
    let cur = 0;
    for (const l of lines) {
      lineOffsets.push(cur);
      cur += l.length + 1;
    }

    let pos = 0;
    while ((pos = lower.indexOf(query, pos)) !== -1) {
      let lineIdx = lineOffsets.findIndex((offset, idx) => {
        const next = lineOffsets[idx + 1] ?? Infinity;
        return pos >= offset && pos < next;
      });
      if (lineIdx === -1) lineIdx = 0;

      matches.push({
        start: pos,
        end: pos + query.length,
        line: lineIdx + 1,
      });
      pos += query.length;
    }
    return matches;
  }, [searchQuery, yaml]);

  const jumpToMatch = (targetIdx: number) => {
    if (searchMatches.length === 0) return;
    const nextIdx = (targetIdx + searchMatches.length) % searchMatches.length;
    setCurrentMatchIdx(nextIdx);
    const match = searchMatches[nextIdx];

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(match.start, match.end);
      const lineHeight = 20;
      textarea.scrollTop = Math.max(0, (match.line - 6) * lineHeight);
      if (gutterRef.current) {
        gutterRef.current.scrollTop = textarea.scrollTop;
      }
    }
  };

  useEffect(() => {
    if (searchMatches.length > 0) {
      jumpToMatch(0);
    } else {
      setCurrentMatchIdx(0);
    }
  }, [searchMatches.length]);

  // Global Keyboard shortcuts: Cmd+F / Ctrl+F opens search
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSearchOpen]);

  if (!isOpen || !resource) return null;

  const handleReview = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await api.dryRunApply(yaml, resource.namespace);
      setDryRun(result);
      setStep('diff');
    } catch (e: any) {
      setError(e?.message || String(e));
      setStep('diff');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setIsApplying(true);
    setError(null);
    try {
      await api.applyManifest(yaml, resource.namespace);
      onApplied?.();
      onClose();
    } catch (e: any) {
      setError(e?.message || String(e));
      setStep('edit');
    } finally {
      setIsApplying(false);
    }
  };

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetToOriginal = () => {
    setYaml(originalYaml);
    setError(null);
  };

  const lineCount = yaml.split('\n').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-100">
      <div className="bg-surface-elevated border border-border rounded-xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-border bg-surface flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 shrink-0">
              {step === 'edit' ? <Pencil className="w-5 h-5" /> : <GitCompare className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white tracking-tight truncate">
                  {step === 'edit' ? 'Edit YAML' : 'Review YAML Changes'}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated font-mono text-indigo-300 border border-border/80 truncate">
                  {resource.kind}/{resource.name}
                </span>
                {isSecret && step === 'edit' && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-mono font-medium shrink-0">
                    {secretMode === 'decoded' ? 'Decoded stringData' : 'Raw Base64'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 truncate">
                {step === 'edit'
                  ? isReadOnly
                    ? 'Read-only mode — write access disabled.'
                    : 'Edit, review changes diff, and execute dry-run verification before applying.'
                  : 'Review exact line-by-line differences against live cluster state.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* View Mode Switcher: Editor vs Diff */}
            <div className="flex items-center bg-surface-elevated p-0.5 rounded-lg border border-border text-xs font-mono">
              <button
                type="button"
                onClick={() => setStep('edit')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center space-x-1.5 transition-colors ${
                  step === 'edit'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-surface'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Editor</span>
              </button>
              <button
                type="button"
                onClick={() => setStep('diff')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center space-x-1.5 transition-colors ${
                  step === 'diff'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-surface'
                }`}
                title="View line-by-line diff of what changed"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Diff</span>
                {hasModifications && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    +{fullDiffStats.additions} -{fullDiffStats.deletions}
                  </span>
                )}
              </button>
            </div>

            {/* Search Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen((v) => !v);
                if (!isSearchOpen) {
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }
              }}
              className={`p-1.5 rounded-md border text-xs flex items-center space-x-1.5 transition-colors ${
                isSearchOpen
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                  : 'bg-surface-elevated border-border text-gray-400 hover:text-gray-200 hover:bg-surface'
              }`}
              title="Find in YAML (Cmd+F / Ctrl+F)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search</span>
            </button>

            {/* Secret Decoded/Raw Switcher */}
            {isSecret && step === 'edit' && (
              <div className="bg-surface-elevated p-0.5 rounded-lg border border-border flex items-center text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setSecretMode('decoded')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center space-x-1 ${
                    secretMode === 'decoded'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="View and edit secret decoded into human-readable stringData"
                >
                  <Unlock className="w-3 h-3" />
                  <span>Decoded</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSecretMode('raw')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center space-x-1 ${
                    secretMode === 'raw'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="View raw base64 data"
                >
                  <Lock className="w-3 h-3" />
                  <span>Raw</span>
                </button>
              </div>
            )}

            {/* Copy YAML */}
            <button
              type="button"
              onClick={handleCopyYaml}
              className="p-1.5 rounded-md bg-surface-elevated border border-border text-gray-400 hover:text-gray-200 hover:bg-surface transition-colors"
              title="Copy YAML to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {isSearchOpen && (
          <div className="px-6 py-2 bg-surface/90 border-b border-border flex items-center space-x-3 text-xs animate-in slide-in-from-top-1 duration-100">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) {
                      jumpToMatch(currentMatchIdx - 1);
                    } else {
                      jumpToMatch(currentMatchIdx + 1);
                    }
                  } else if (e.key === 'Escape') {
                    setIsSearchOpen(false);
                  }
                }}
                placeholder="Find in YAML (press Enter for next, Shift+Enter for prev)..."
                className="w-full bg-surface-elevated border border-border rounded-md pl-8 pr-20 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-mono select-none">
                {searchMatches.length > 0 ? (
                  <span>
                    {currentMatchIdx + 1} of {searchMatches.length}
                  </span>
                ) : searchQuery ? (
                  <span className="text-rose-400">0 matches</span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => jumpToMatch(currentMatchIdx - 1)}
                disabled={searchMatches.length === 0}
                className="p-1 rounded hover:bg-surface-elevated text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                title="Previous match (Shift+Enter)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => jumpToMatch(currentMatchIdx + 1)}
                disabled={searchMatches.length === 0}
                className="p-1 rounded hover:bg-surface-elevated text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                title="Next match (Enter)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="p-1 rounded hover:bg-surface-elevated text-gray-400 hover:text-white transition-colors ml-1"
                title="Close search (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="px-6 py-2.5 bg-rose-950/80 border-b border-rose-600 flex items-start space-x-2 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap font-mono flex-1">{error}</span>
          </div>
        )}

        {/* Diff Mode Secondary Toolbar */}
        {step === 'diff' && (
          <div className="px-6 py-2 bg-surface/60 border-b border-border flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-3">
              <span className="text-gray-400 text-xs">Diff view:</span>
              <div className="flex items-center bg-surface-elevated p-0.5 rounded border border-border text-[11px]">
                <button
                  type="button"
                  onClick={() => setDiffMode('compact')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    diffMode === 'compact'
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="Show only modified sections with 3 lines of context"
                >
                  Changes Only (Compact)
                </button>
                <button
                  type="button"
                  onClick={() => setDiffMode('full')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    diffMode === 'full'
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="Show entire YAML with changes inline"
                >
                  Full Document
                </button>
              </div>

              <div className="flex items-center space-x-2 text-[11px]">
                <span className="text-emerald-400 font-semibold">+{fullDiffStats.additions} added</span>
                <span className="text-gray-600">·</span>
                <span className="text-rose-400 font-semibold">-{fullDiffStats.deletions} removed</span>
              </div>
            </div>

            {dryRun ? (
              <div className="flex items-center space-x-1.5 text-emerald-400 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Dry-Run Validation Passed</span>
              </div>
            ) : (
              <span className="text-[11px] text-gray-500">Local Diff Preview</span>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex flex-col bg-background relative">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-xs space-x-2">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              <span>{step === 'edit' ? 'Loading resource YAML…' : 'Running server-side dry-run validation…'}</span>
            </div>
          ) : step === 'edit' ? (
            <div className="flex-1 flex min-h-0 overflow-hidden bg-background">
              {/* Line Numbers Gutter */}
              <div
                ref={gutterRef}
                className="py-4 px-2 select-none text-right font-mono text-xs text-gray-600 bg-surface/30 border-r border-border min-w-[3.5rem] overflow-hidden leading-[20px]"
              >
                {Array.from({ length: lineCount }, (_, i) => {
                  const lineNum = i + 1;
                  const isMatch = searchMatches.some((m) => m.line === lineNum);
                  return (
                    <div
                      key={lineNum}
                      className={isMatch ? 'text-amber-300 font-bold bg-amber-500/20 rounded px-0.5' : ''}
                    >
                      {lineNum}
                    </div>
                  );
                })}
              </div>

              {/* Textarea Editor */}
              <div className="flex-1 relative overflow-hidden">
                <textarea
                  ref={textareaRef}
                  value={yaml}
                  aria-label="YAML Editor"
                  onChange={(e) => setYaml(e.target.value)}
                  onScroll={(e) => {
                    if (gutterRef.current) {
                      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                    }
                  }}
                  readOnly={isReadOnly}
                  spellCheck={false}
                  placeholder="# Enter or edit Kubernetes YAML manifest..."
                  className="w-full h-full bg-transparent p-4 font-mono text-xs text-gray-200 focus:outline-none resize-none leading-[20px] selection:bg-indigo-500/30 selection:text-white"
                />
              </div>
            </div>
          ) : (
            /* Diff View */
            <div className="flex-1 overflow-auto p-4 font-mono text-xs text-gray-200 divide-y divide-border/20 select-text">
              {localDiff.lines.length === 0 || (!hasModifications && (!dryRun || !dryRun.diff)) ? (
                <div className="py-16 text-center text-gray-500 font-sans text-xs space-y-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                  <p>No changes detected between the live resource and editor state.</p>
                  <button
                    type="button"
                    onClick={() => setStep('edit')}
                    className="text-indigo-400 hover:underline font-mono text-xs"
                  >
                    ← Back to Editor to make changes
                  </button>
                </div>
              ) : (
                localDiff.lines.map((line, idx) => {
                  if (line.type === 'collapse') {
                    return (
                      <div
                        key={idx}
                        className="py-1.5 px-4 bg-surface-elevated/30 border-y border-border/40 text-center text-xs font-mono text-gray-500 select-none"
                      >
                        {line.text}
                      </div>
                    );
                  }

                  let rowBg = 'hover:bg-surface-elevated/30';
                  let markerColor = 'text-gray-600';
                  let textColor = 'text-gray-300';

                  if (line.type === 'add') {
                    rowBg = 'bg-emerald-950/40 border-l-2 border-emerald-500 hover:bg-emerald-950/60';
                    markerColor = 'text-emerald-400 font-bold';
                    textColor = 'text-emerald-200';
                  } else if (line.type === 'remove') {
                    rowBg = 'bg-rose-950/40 border-l-2 border-rose-500 hover:bg-rose-950/60';
                    markerColor = 'text-rose-400 font-bold';
                    textColor = 'text-rose-200 line-through opacity-80';
                  }

                  const isSearchMatch =
                    searchQuery.trim() && line.text.toLowerCase().includes(searchQuery.toLowerCase());

                  return (
                    <div
                      key={idx}
                      className={`px-3 py-0.5 flex font-mono text-xs leading-[20px] transition-colors ${rowBg} ${
                        isSearchMatch ? 'ring-1 ring-amber-400/50 bg-amber-500/10' : ''
                      }`}
                    >
                      {/* Old Line Number */}
                      <span className="w-10 select-none text-right pr-2.5 text-gray-600 text-[11px]">
                        {line.oldLineNumber ?? ''}
                      </span>
                      {/* New Line Number */}
                      <span className="w-10 select-none text-right pr-2.5 text-gray-600 text-[11px] border-r border-border/40">
                        {line.newLineNumber ?? ''}
                      </span>
                      {/* Marker (+ / - / space) */}
                      <span className={`w-6 select-none text-center ${markerColor}`}>
                        {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                      </span>
                      {/* Code Content */}
                      <span className={`flex-1 whitespace-pre pl-1 ${textColor}`}>
                        {line.text || ' '}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border bg-surface flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            {isReadOnly ? (
              <>
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Read-only mode — cluster modifications are locked.</span>
              </>
            ) : hasModifications ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-300 font-medium">Unsaved changes detected.</span>
              </>
            ) : (
              <span>YAML is in sync with the live cluster resource.</span>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            {hasModifications && step === 'edit' && (
              <button
                type="button"
                onClick={handleResetToOriginal}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-surface-elevated border border-border transition-colors flex items-center space-x-1.5"
                title="Discard all changes and reset to live cluster YAML"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            {step === 'diff' ? (
              <button
                type="button"
                onClick={() => setStep('edit')}
                disabled={isApplying}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:bg-surface-hover border border-border transition-colors"
              >
                Back to Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:bg-surface-hover border border-border transition-colors"
              >
                Cancel
              </button>
            )}

            {step === 'edit' ? (
              <button
                type="button"
                onClick={handleReview}
                disabled={loading || isReadOnly || !hasModifications}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950 flex items-center space-x-2 disabled:opacity-50 transition-all"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Review Changes (Dry Run)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApply}
                disabled={isApplying || isReadOnly}
                className="px-5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950 flex items-center space-x-2 disabled:opacity-50 transition-all"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Applying to Cluster…</span>
                  </>
                ) : (
                  <span>Approve & Apply</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
