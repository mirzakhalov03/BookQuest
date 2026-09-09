import { Component, type ReactNode } from 'react';
import { ErrorState } from '@/components/feedback/ErrorState';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: unknown;
}

/**
 * The last net, wrapping `<Providers>` in App.tsx — outside the router
 * entirely. `RouteErrorBoundary` (the router's `errorElement`) only catches
 * what throws inside the routed tree; a crash while a provider is booting —
 * `AuthProvider`'s splash, `QueryClientProvider` itself — happens above that
 * and would otherwise unmount the whole app to a blank page with nothing on
 * screen at all. A class component is the only way to get
 * getDerivedStateFromError/componentDidCatch; there is no hook equivalent.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: unknown, info: { componentStack?: string | null }): void {
    // Nowhere to report this yet — at least leave a trace instead of swallowing it.
    console.error('Uncaught render error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <div className="flex min-h-dvh flex-col">
          <ErrorState
            error={this.state.error}
            onRetry={() => window.location.assign('/')}
            retryLabel="Back to start"
          />
        </div>
      );
    }

    return this.props.children;
  }
}
