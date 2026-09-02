import React, { useState, useMemo } from 'react';
import {
  Tag,
  FileText,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  Code,
} from 'lucide-react';

interface MetadataLabelsAnnotationsProps {
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  podTemplateLabels?: Record<string, string>;
  podTemplateAnnotations?: Record<string, string>;
  className?: string;
}

export const MetadataLabelsAnnotations: React.FC<MetadataLabelsAnnotationsProps> = ({
  labels = {},
  annotations = {},
  podTemplateLabels,
  podTemplateAnnotations,
  className = '',
}) => {
  const [labelFilter, setLabelFilter] = useState('');
  const [annotationFilter, setAnnotationFilter] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<'labels' | 'annotations' | null>(null);
  const [expandedAnnotations, setExpandedAnnotations] = useState<Record<string, boolean>>({});
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'resource' | 'template'>('resource');

  const activeLabels = activeSubTab === 'template' && podTemplateLabels ? podTemplateLabels : labels;
  const activeAnnotations = activeSubTab === 'template' && podTemplateAnnotations ? podTemplateAnnotations : annotations;

  const labelEntries = useMemo(() => Object.entries(activeLabels || {}), [activeLabels]);
  const annotationEntries = useMemo(() => Object.entries(activeAnnotations || {}), [activeAnnotations]);

  const filteredLabels = useMemo(() => {
    if (!labelFilter.trim()) return labelEntries;
    const q = labelFilter.toLowerCase();
    return labelEntries.filter(
      ([k, v]) => k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q)
    );
  }, [labelEntries, labelFilter]);

  const filteredAnnotations = useMemo(() => {
    if (!annotationFilter.trim()) return annotationEntries;
    const q = annotationFilter.toLowerCase();
    return annotationEntries.filter(
      ([k, v]) => k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q)
    );
  }, [annotationEntries, annotationFilter]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyAll = (type: 'labels' | 'annotations') => {
    const data = type === 'labels' ? activeLabels : activeAnnotations;
    const yamlStr = Object.entries(data || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    navigator.clipboard.writeText(yamlStr);
    setCopiedAll(type);
    setTimeout(() => setCopiedAll(null), 2000);
  };

  const toggleAnnotation = (key: string) => {
    setExpandedAnnotations((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const formatAnnotationValue = (val: string) => {
    if (!val) return { isJson: false, isMultiline: false, formatted: '' };
    const trimmed = val.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return { isJson: true, isMultiline: true, formatted: JSON.stringify(parsed, null, 2) };
      } catch {
        // Not valid JSON
      }
    }
    const isMultiline = val.includes('\n') || val.length > 80;
    return { isJson: false, isMultiline, formatted: val };
  };

  const visibleLabels = showAllLabels ? filteredLabels : filteredLabels.slice(0, 16);
  const hasTemplateMetadata = Boolean(podTemplateLabels || podTemplateAnnotations);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Optional Sub-tab switcher for Workloads with Pod Template */}
      {hasTemplateMetadata && (
        <div className="flex items-center space-x-2 border-b border-border/60 pb-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('resource')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-colors ${
              activeSubTab === 'resource'
                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Resource Metadata ({labelEntries.length} Labels · {annotationEntries.length} Annotations)
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('template')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-colors ${
              activeSubTab === 'template'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Pod Template Metadata ({Object.keys(podTemplateLabels || {}).length} Labels)
          </button>
        </div>
      )}

      {/* 1. Labels Explorer */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="p-3.5 bg-[#0B0F17] border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-gray-200 font-mono">Labels</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                  {labelEntries.length}
                </span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">Kubernetes selectors & organization tags</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {labelEntries.length > 4 && (
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2.5 top-2 text-gray-500" />
                <input
                  type="text"
                  value={labelFilter}
                  onChange={(e) => setLabelFilter(e.target.value)}
                  placeholder="Filter labels…"
                  className="pl-7 pr-2.5 py-1 bg-surface border border-border rounded-lg text-[11px] text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-brand-500 w-36 sm:w-48"
                />
              </div>
            )}

            {labelEntries.length > 0 && (
              <button
                type="button"
                onClick={() => handleCopyAll('labels')}
                className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-[11px] font-mono text-gray-300 hover:text-white flex items-center space-x-1.5 transition-colors"
                title="Copy all labels as YAML"
              >
                {copiedAll === 'labels' ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-gray-400" />
                )}
                <span>Copy All</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-4">
          {labelEntries.length === 0 ? (
            <div className="text-xs font-mono text-gray-500 py-2 italic text-center">
              No labels defined on this resource.
            </div>
          ) : filteredLabels.length === 0 ? (
            <div className="text-xs font-mono text-gray-400 py-2 text-center">
              No labels matching "{labelFilter}".
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {visibleLabels.map(([key, val]) => {
                  const isSystem = key.startsWith('app.kubernetes.io/') || key.startsWith('k8s-app') || key.startsWith('helm.sh/');
                  const isCopied = copiedKey === `label-${key}`;

                  return (
                    <div
                      key={key}
                      onClick={() => handleCopy(`${key}: ${val}`, `label-${key}`)}
                      className={`group cursor-pointer flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all hover:scale-[1.02] select-text ${
                        isSystem
                          ? 'bg-indigo-950/30 border-indigo-700/50 hover:border-indigo-500 text-indigo-200'
                          : 'bg-[#10141D] border-border/80 hover:border-cyan-500/60 text-gray-300'
                      }`}
                      title="Click to copy label"
                    >
                      <span className="text-gray-400 font-medium">{key}</span>
                      <span className="text-gray-600">=</span>
                      <span className="text-cyan-300 font-bold">{String(val)}</span>
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-gray-400 hover:text-white"
                      >
                        {isCopied ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {filteredLabels.length > 16 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAllLabels(!showAllLabels)}
                    className="text-xs font-mono text-cyan-400 hover:text-cyan-300 hover:underline flex items-center space-x-1"
                  >
                    <span>{showAllLabels ? 'Show fewer labels' : `Show all ${filteredLabels.length} labels…`}</span>
                    {showAllLabels ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Annotations Explorer */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="p-3.5 bg-[#0B0F17] border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-gray-200 font-mono">Annotations</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                  {annotationEntries.length}
                </span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">System metadata, configurations & runtime directives</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {annotationEntries.length > 3 && (
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2.5 top-2 text-gray-500" />
                <input
                  type="text"
                  value={annotationFilter}
                  onChange={(e) => setAnnotationFilter(e.target.value)}
                  placeholder="Filter annotations…"
                  className="pl-7 pr-2.5 py-1 bg-surface border border-border rounded-lg text-[11px] text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-brand-500 w-36 sm:w-48"
                />
              </div>
            )}

            {annotationEntries.length > 0 && (
              <button
                type="button"
                onClick={() => handleCopyAll('annotations')}
                className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-[11px] font-mono text-gray-300 hover:text-white flex items-center space-x-1.5 transition-colors"
                title="Copy all annotations as YAML"
              >
                {copiedAll === 'annotations' ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-gray-400" />
                )}
                <span>Copy All</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-4">
          {annotationEntries.length === 0 ? (
            <div className="text-xs font-mono text-gray-500 py-2 italic text-center">
              No annotations defined on this resource.
            </div>
          ) : filteredAnnotations.length === 0 ? (
            <div className="text-xs font-mono text-gray-400 py-2 text-center">
              No annotations matching "{annotationFilter}".
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAnnotations.map(([key, rawVal]) => {
                const isExpanded = Boolean(expandedAnnotations[key]);
                const isCopied = copiedKey === `annotation-${key}`;
                const { isJson, isMultiline, formatted } = formatAnnotationValue(String(rawVal));

                return (
                  <div
                    key={key}
                    className="p-3.5 rounded-xl bg-[#10141D] border border-border/80 space-y-2 font-mono text-xs hover:border-border transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        {isMultiline && (
                          <button
                            type="button"
                            onClick={() => toggleAnnotation(key)}
                            className="p-0.5 rounded text-gray-400 hover:text-gray-200"
                          >
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />}
                          </button>
                        )}
                        <span className="font-bold text-indigo-300 truncate" title={key}>
                          {key}
                        </span>
                        {isJson && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-purple-950/60 text-purple-300 border border-purple-800 rounded font-semibold flex items-center space-x-1">
                            <Code className="w-2.5 h-2.5" />
                            <span>JSON</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-[10px] text-gray-500">
                          {String(rawVal).length} chars
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(formatted, `annotation-${key}`)}
                          className="p-1 rounded hover:bg-surface-elevated text-gray-400 hover:text-white transition-colors"
                          title="Copy annotation value"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Value Container */}
                    {isMultiline ? (
                      <div>
                        {isExpanded ? (
                          <pre className="p-3 rounded-lg bg-[#0B0F17] border border-border/60 text-[11px] text-amber-200/90 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72">
                            {formatted}
                          </pre>
                        ) : (
                          <div
                            onClick={() => toggleAnnotation(key)}
                            className="p-2 rounded-lg bg-[#0B0F17]/60 border border-border/40 text-[11px] text-gray-400 truncate cursor-pointer hover:text-gray-300"
                            title="Click to expand"
                          >
                            {formatted.slice(0, 120)}… <span className="text-indigo-400 font-semibold text-[10px]">(Click to expand)</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-[#0B0F17] border border-border/40 text-[11px] text-amber-200/90 break-all select-text">
                        {formatted || '""'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
