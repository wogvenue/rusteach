// Last line of defence: a page that throws while rendering shows a recovery card instead of
// leaving the whole window blank. App passes the route as resetKey, so navigating away clears it.
import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentDidCatch(error: Error) {
    console.error('Sayfa çöktü:', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
        <div className="max-w-sm">
          <div className="text-5xl" aria-hidden="true">
            🦀
          </div>
          <h1 className="mt-4 text-lg font-bold text-fg">Bu sayfa açılırken bir sorun çıktı</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">İlerlemen güvende. Ana sayfaya dönüp tekrar deneyebilirsin.</p>
          <p className="mt-3 break-words font-mono text-xs text-subtle">{error.message}</p>
          <div className="mt-6 flex justify-center gap-2">
            <a
              href="#/"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Ana sayfa
            </a>
            <button
              type="button"
              onClick={() => location.reload()}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Yeniden yükle
            </button>
          </div>
        </div>
      </div>
    );
  }
}
