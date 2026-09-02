import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Copy, Check } from 'lucide-react';
import { CrashAlertIllustration } from '../../assets/brand/EmptyStateIllustrations';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in UI:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleCopy = () => {
    const errorDetails = `Error: ${this.state.error?.message}\n\nStack:\n${this.state.error?.stack}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack}`;
    navigator.clipboard.writeText(errorDetails);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#0B0F17] text-gray-100 flex items-center justify-center p-6 select-none font-sans">
          <div className="max-w-xl w-full bg-[#111827] border border-[#1F2937] rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center space-y-6">
            {/* Crash Illustration */}
            <div className="w-48 h-36 flex items-center justify-center">
              <CrashAlertIllustration size={180} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-center space-x-2 text-rose-400 font-semibold text-sm uppercase tracking-wider font-mono">
                <AlertTriangle className="w-4 h-4" />
                <span>Application Execution Interrupted</span>
              </div>
              <h2 className="text-xl font-bold text-white">
                Something unexpected happened
              </h2>
              <p className="text-xs text-gray-400 max-w-md">
                The application encountered an error while rendering. Your cluster session and credentials remain completely secure.
              </p>
            </div>

            {/* Error Message Box */}
            <div className="w-full bg-[#0B0F17] border border-gray-800 rounded-xl p-3 text-left">
              <div className="text-[11px] font-mono text-rose-400 break-words line-clamp-3">
                {this.state.error?.message || 'Unknown runtime error'}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3 w-full justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-xl bg-[#326CE5] hover:bg-[#2557C7] text-white text-xs font-semibold flex items-center space-x-2 transition-all shadow-lg shadow-[#326CE5]/20"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span>Reload Application</span>
              </button>

              <button
                onClick={this.handleCopy}
                className="px-4 py-2 rounded-xl bg-[#1F2937] hover:bg-[#374151] border border-gray-700 text-gray-300 hover:text-white text-xs font-medium flex items-center space-x-2 transition-all"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied Details</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Error Log</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
