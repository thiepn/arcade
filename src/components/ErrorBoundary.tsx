import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Micro Arcade runtime error:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen w-full bg-[#0A0A0B] text-white flex items-center justify-center p-6">
        <section
          role="alert"
          className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#111114] p-6 text-center shadow-2xl"
        >
          <h1 className="text-lg font-black tracking-tight">ARCADE RECOVERED</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            This screen hit an unexpected error. Your local scores and preferences are still stored.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-5 min-h-11 rounded-xl bg-white px-4 py-2 text-xs font-black text-black hover:bg-zinc-200"
          >
            TRY AGAIN
          </button>
        </section>
      </main>
    );
  }
}
