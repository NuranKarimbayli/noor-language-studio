import { Component, ReactNode } from 'react';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { t } from '../i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(t('ErrorBoundary caught an error:'), error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoBack = () => {
    this.setState({ hasError: false, error: null });
    if (window.history.length > 1) {
      window.history.back();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[70vh] flex items-center justify-center bg-[#FAF8F5] dark:bg-[#121110] px-4 py-10">
          <div className="max-w-md w-full bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl shadow-lg p-8 text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-red-50 dark:bg-red-950/30 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>

            <div className="space-y-2">
              <h1 className="font-display text-2xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                {t('Something went wrong')}
              </h1>
              <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                We encountered an unexpected error. Your saved data is safe — you can
                try again or go back to continue.
              </p>
            </div>

            {this.state.error && (
              <details className="text-left">
                <summary className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E] cursor-pointer hover:text-[#1C1917] dark:hover:text-[#F5F2EC]">
                  {t('View error details')}
                </summary>
                <pre className="mt-2 p-3 bg-[#F3EFE8] dark:bg-[#25221E] rounded-lg text-xs text-[#57534E] dark:text-[#A8A29E] overflow-auto max-h-32">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {t('Try Again')}
              </button>
              <button
                type="button"
                onClick={this.handleGoBack}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200 dark:border-[#2E2A25] text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC] hover:border-[#B45309] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('Go Back')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
