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

        <div className="p-0">
          {labelEntries.length === 0 ? (
            <div className="text-xs font-mono text-gray-500 p-6 italic text-center">
              No labels defined on this resource.
            </div>
          ) : filteredLabels.length === 0 ? (
            <div className="text-xs font-mono text-gray-400 p-6 text-center">
              No labels matching "{labelFilter}".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-[#070A0F] text-[11px] text-gray-400 font-semibold uppercase tracking-wider select-none">
                    <th className="py-2.5 px-4 w-2/5 sm:w-1/3">Key</th>
                    <th className="py-2.5 px-4">Value</th>
                    <th className="py-2.5 px-4 w-24 text-right">Length</th>
                    <th className="py-2.5 px-3 w-14 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredLabels.map(([key, val]) => {
                    const isSystem =
                      key.startsWith('app.kubernetes.io/') ||
                      key.startsWith('k8s-app') ||
                      key.startsWith('helm.sh/') ||
                      key.startsWith('security.istio.io/') ||
                      key.startsWith('service.istio.io/') ||
                      key.startsWith('pod-template-hash');
                    const isCopied = copiedKey === `label-${key}`;
                    const strVal = String(val);

                    return (
                      <tr
                        key={key}
                        className="hover:bg-surface-elevated/40 transition-colors align-middle group"
                      >
                        {/* Key Column */}
                        <td className="py-2.5 px-4 align-middle">
                          <div className="flex items-center space-x-2 min-w-0">
                            {isSystem && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/80 font-bold uppercase tracking-wider shrink-0 font-mono">
                                SYS
                              </span>
                            )}
                            <span
                              className="text-gray-300 font-medium break-all select-text"
                              title={key}
                            >
                              {key}
                            </span>
                          </div>
                        </td>

                        {/* Value Column */}
                        <td className="py-2.5 px-4 align-middle">
                          <div className="flex items-center min-w-0">
                            <span
                              className="text-cyan-300 font-semibold break-all select-text bg-[#0B0F17]/60 px-2 py-0.5 rounded border border-cyan-950/60"
                              title={strVal}
                            >
                              {strVal}
                            </span>
                          </div>
                        </td>

                        {/* Length Column */}
                        <td className="py-2.5 px-4 text-right align-middle text-gray-500 text-[11px] whitespace-nowrap">
                          {strVal.length} chars
                        </td>

                        {/* Copy Action Column */}
                        <td className="py-2.5 px-3 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => handleCopy(`${key}: ${strVal}`, `label-${key}`)}
                            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            title="Copy label (Key: Value)"
                            aria-label={`Copy label ${key}`}
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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

        <div className="p-0">
          {annotationEntries.length === 0 ? (
            <div className="text-xs font-mono text-gray-500 p-6 italic text-center">
              No annotations defined on this resource.
            </div>
          ) : filteredAnnotations.length === 0 ? (
            <div className="text-xs font-mono text-gray-400 p-6 text-center">
              No annotations matching "{annotationFilter}".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-[#070A0F] text-[11px] text-gray-400 font-semibold uppercase tracking-wider select-none">
                    <th className="py-2.5 px-4 w-2/5 sm:w-1/3">Key</th>
                    <th className="py-2.5 px-4">Value</th>
                    <th className="py-2.5 px-4 w-24 text-right">Length</th>
                    <th className="py-2.5 px-3 w-14 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredAnnotations.map(([key, rawVal]) => {
                    const isExpanded = Boolean(expandedAnnotations[key]);
                    const isCopied = copiedKey === `annotation-${key}`;
                    const { isJson, isMultiline, formatted } = formatAnnotationValue(String(rawVal));

                    return (
                      <tr
                        key={key}
                        className="hover:bg-surface-elevated/40 transition-colors align-top group"
                      >
                        {/* Key Column */}
                        <td className="py-2.5 px-4 align-top">
                          <div className="flex items-start space-x-1.5 min-w-0">
                            {isMultiline && (
                              <button
                                type="button"
                                onClick={() => toggleAnnotation(key)}
                                className="p-0.5 mt-0.5 rounded text-gray-400 hover:text-white transition-colors shrink-0"
                                title={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-brand-400" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
                                )}
                              </button>
                            )}
                            <div className="min-w-0">
                              <span
                                className="font-bold text-indigo-300 break-all select-text inline-block"
                                title={key}
                              >
                                {key}
                              </span>
                              {isJson && (
                                <span className="ml-1.5 inline-flex items-center space-x-1 text-[10px] px-1.5 py-0.2 bg-purple-950/60 text-purple-300 border border-purple-800 rounded font-semibold align-middle">
                                  <Code className="w-2.5 h-2.5" />
                                  <span>JSON</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Value Column */}
                        <td className="py-2.5 px-4 align-top">
                          {isMultiline ? (
                            <div>
                              {isExpanded ? (
                                <pre className="p-2.5 rounded-lg bg-[#0B0F17] border border-border/60 text-[11px] text-amber-200/90 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72 select-text">
                                  {formatted}
                                </pre>
                              ) : (
                                <div
                                  onClick={() => toggleAnnotation(key)}
                                  className="text-[11px] text-gray-300 truncate cursor-pointer hover:text-amber-200 flex items-center space-x-1.5 select-text"
                                  title="Click to expand multiline value"
                                >
                                  <span className="truncate max-w-lg">{formatted.slice(0, 100)}</span>
                                  <span className="text-indigo-400 text-[10px] font-semibold shrink-0">
                                    [+ expand]
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-amber-200/90 break-all select-text font-mono">
                              {formatted || '""'}
                            </span>
                          )}
                        </td>

                        {/* Length Column */}
                        <td className="py-2.5 px-4 align-top text-right text-[10px] text-gray-500 whitespace-nowrap pt-3">
                          {String(rawVal).length} chars
                        </td>

                        {/* Action Column */}
                        <td className="py-2.5 px-3 align-top text-center pt-2.5">
                          <button
                            type="button"
                            onClick={() => handleCopy(formatted, `annotation-${key}`)}
                            className="p-1 rounded hover:bg-surface-elevated text-gray-400 hover:text-white transition-colors"
                            title="Copy annotation value"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
