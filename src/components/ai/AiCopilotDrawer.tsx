import React, { useState } from 'react';
import { AiChatMessage, PendingAiProposal } from '../../types/cluster';
import { Bot, Send, ShieldAlert, Check, X, Cpu, Lock } from 'lucide-react';

interface AiCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApproveProposal: (proposal: PendingAiProposal) => void;
  onRejectProposal: (proposal: PendingAiProposal) => void;
}

export const AiCopilotDrawer: React.FC<AiCopilotDrawerProps> = ({
  isOpen,
  onClose,
  onApproveProposal,
  onRejectProposal,
}) => {
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'msg-1',
      role: 'assistant',
      content:
        'Hello! I am your k8sUI AI Copilot. I operate under strict zero-trust rules: I can inspect read-only workload health, and any proposed mutations will require your explicit dry-run approval before executing.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [modelType, setModelType] = useState<'local_ollama' | 'anthropic_claude' | 'openai_gpt'>('local_ollama');

  if (!isOpen) return null;

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMsg: AiChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    // Simulate AI response with whitelisted tool call and dry-run proposal if mutating
    setTimeout(() => {
      if (userMsg.content.toLowerCase().includes('scale')) {
        const proposal: PendingAiProposal = {
          proposal_id: `prop-${Date.now()}`,
          tool_call: {
            tool: 'scale_deployment',
            params: { namespace: 'default', name: 'auth-service', replicas: 3 },
          },
          dry_run_diff: '--- live: replicas: 1\n+++ proposed: replicas: 3\n@@ spec.replicas @@',
          explanation: 'Scale auth-service from 1 to 3 replicas to handle peak load.',
          target_cluster: 'active-cluster',
          created_at: new Date().toISOString(),
        };

        const aiMsg: AiChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content:
            'I have formulated a scaling plan. In accordance with zero-trust safety policy, please review the dry-run diff below before approving:',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          pending_proposal: proposal,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        const aiMsg: AiChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content:
            'I inspected the pods in the default namespace via the whitelisted `list_pods` tool. All 2 workloads are healthy, but `metrics-exporter` in `kube-system` has 14 restart events due to CrashLoopBackOff.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
    }, 600);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-surface-elevated border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 border-b border-border bg-surface flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>k8sUI Copilot</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                Whitelist Only
              </span>
            </h3>
            <div className="flex items-center space-x-1.5 text-[11px] text-gray-400">
              <Cpu className="w-3 h-3 text-emerald-400" />
              <span>Model:</span>
              <select
                value={modelType}
                onChange={(e: any) => setModelType(e.target.value)}
                className="bg-transparent text-emerald-300 font-mono focus:outline-none"
              >
                <option value="local_ollama" className="bg-surface">Ollama (Local Air-Gapped)</option>
                <option value="anthropic_claude" className="bg-surface">Anthropic Claude</option>
                <option value="openai_gpt" className="bg-surface">OpenAI GPT</option>
              </select>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Safety Notice */}
      <div className="px-4 py-2 bg-indigo-950/30 border-b border-indigo-900/40 text-[11px] text-indigo-300 flex items-center space-x-2">
        <Lock className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
        <span>Cluster data framed as untrusted. No mutations execute without dry-run diff approval.</span>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-surface border border-border text-gray-200 rounded-bl-none shadow-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* Pending Proposal Card */}
              {msg.pending_proposal && (
                <div className="mt-3 p-3 rounded-lg bg-surface-elevated border border-amber-500/40 space-y-2">
                  <div className="flex items-center space-x-2 text-amber-400 font-semibold text-[11px]">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Action Requires Confirmation</span>
                  </div>
                  <div className="font-mono text-[11px] text-gray-300 bg-background/80 p-2 rounded border border-border">
                    {msg.pending_proposal.dry_run_diff}
                  </div>
                  <div className="flex items-center justify-end space-x-2 pt-1">
                    <button
                      onClick={() => onRejectProposal(msg.pending_proposal!)}
                      className="px-2.5 py-1 rounded bg-surface border border-border hover:bg-surface-hover text-gray-300 text-[11px] flex items-center space-x-1"
                    >
                      <X className="w-3 h-3" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => onApproveProposal(msg.pending_proposal!)}
                      className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center space-x-1 shadow"
                    >
                      <Check className="w-3 h-3" />
                      <span>Approve & Apply</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <span className="text-[10px] text-gray-500 mt-1 px-1">{msg.timestamp}</span>
          </div>
        ))}
      </div>

      {/* Prompt Input */}
      <div className="p-3 border-t border-border bg-surface">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask AI to troubleshoot or scale..."
            className="flex-1 bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
