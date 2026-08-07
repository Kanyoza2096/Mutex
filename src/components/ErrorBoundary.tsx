import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  showDetails: boolean;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, showDetails: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ errorInfo: info });

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error(`[ErrorBoundary] ${this.props.name || 'Component'}:`, error);
      console.error('Component stack:', info.componentStack);
    }

    // TODO: Send to monitoring service in production
    // monitoring.captureException(error, { extras: { name: this.props.name, stack: info.componentStack } });
  }

  componentWillUnmount() {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      showDetails: false,
      retryCount: this.state.retryCount + 1,
    });
    this.props.onRetry?.();
  };

  handleReloadPage = () => {
    window.location.reload();
  };

  handleCopyError = () => {
    const text = [
      `Component: ${this.props.name || 'Unknown'}`,
      `Error: ${this.state.error?.message || 'Unknown error'}`,
      `Stack: ${this.state.error?.stack || 'No stack'}`,
      `Retries: ${this.state.retryCount}`,
    ].join('\n');
    navigator.clipboard.writeText(text);
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isRepeatedFailure = this.state.retryCount >= 2;

      return (
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-brand-surface border border-red-500/20 text-center gap-4 min-h-[220px] relative overflow-hidden">
          
          {/* Background glow */}
          <div className="absolute inset-0 bg-red-500/3 pointer-events-none" />
          
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>

          {/* Title */}
          <div>
            <p className="text-sm font-bold text-white">
              {this.props.name ? `${this.props.name} Crashed` : 'Component Error'}
            </p>
            <p className="text-[10px] text-brand-text-muted font-mono mt-1">
              {isRepeatedFailure ? 'Multiple recovery attempts failed' : 'Something went wrong rendering this component'}
            </p>
          </div>

          {/* Error message */}
          {this.state.error?.message && (
            <p className="text-xs text-red-400/80 font-mono max-w-xs break-all bg-red-500/5 px-3 py-2 rounded-lg border border-red-500/10">
              {this.state.error.message}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-1">
            <button onClick={this.handleRetry}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold font-mono uppercase tracking-wider hover:bg-brand-primary/90 transition-all shadow-glow-primary">
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
            {isRepeatedFailure && (
              <button onClick={this.handleReloadPage}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-elevated border border-brand-border/50 text-brand-text-muted hover:text-white text-xs font-bold font-mono uppercase transition-all">
                <Home className="w-3.5 h-3.5" />
                Reload Page
              </button>
            )}
          </div>

          {/* Details toggle */}
          <button
            onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
            className="flex items-center gap-1 text-[9px] font-mono text-brand-text-muted/50 hover:text-brand-text-muted transition-colors">
            <ChevronDown className={cn('w-3 h-3 transition-transform', this.state.showDetails && 'rotate-180')} />
            {this.state.showDetails ? 'Hide' : 'Show'} details
          </button>

          {/* Expanded details */}
          {this.state.showDetails && (
            <div className="w-full text-left bg-brand-bg/50 rounded-xl border border-brand-border/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold text-brand-text-muted uppercase">Stack Trace</span>
                <button onClick={this.handleCopyError}
                  className="flex items-center gap-1 text-[8px] font-mono text-brand-text-muted hover:text-white transition-colors">
                  <Copy className="w-2.5 h-2.5" /> Copy
                </button>
              </div>
              <pre className="text-[9px] font-mono text-brand-text-muted/70 whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
                {this.state.error?.stack || 'No stack trace available'}
              </pre>
              {this.state.errorInfo?.componentStack && (
                <>
                  <span className="text-[9px] font-mono font-bold text-brand-text-muted uppercase">Component Stack</span>
                  <pre className="text-[9px] font-mono text-brand-text-muted/50 whitespace-pre-wrap max-h-24 overflow-y-auto leading-relaxed">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </>
              )}
            </div>
          )}

          {/* Retry counter */}
          {this.state.retryCount > 0 && (
            <p className="text-[8px] font-mono text-brand-text-muted/40">
              {this.state.retryCount} retry attempt{this.state.retryCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
