import React, { Component, ErrorInfo, ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Immediately align window background with screen type to prevent white flashes
const params = new URLSearchParams(window.location.search);
const screenParam = params.get('screen');

if (screenParam === 'overlay') {
  document.documentElement.style.backgroundColor = '#05080e';
  document.body.style.backgroundColor = '#05080e';
} else if (screenParam === 'toast') {
  document.documentElement.style.backgroundColor = '#0c1017';
  document.body.style.backgroundColor = '#0c1017';
} else {
  document.documentElement.style.backgroundColor = '#070a11';
  document.body.style.backgroundColor = '#070a11';
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Waqt Uncaught React Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#05080e] text-slate-100 flex flex-col items-center justify-center p-8 select-none">
          <div className="max-w-md w-full bg-slate-900/95 border border-slate-800 rounded-xl p-6 text-center space-y-4 shadow-2xl">
            <h2 className="text-xl font-bold text-emerald-400">Waqt Encountered an Error</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              An unexpected error occurred while rendering this screen.
            </p>
            <div className="bg-slate-950 p-3 rounded text-xs text-rose-400 font-mono text-left overflow-auto max-h-32 border border-slate-800">
              {this.state.error?.message || "Unknown error"}
            </div>
            <div className="pt-2 flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-sm font-semibold transition cursor-pointer"
              >
                Reload Window
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

