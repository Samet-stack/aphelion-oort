import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="view view--centered" style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="card" style={{ maxWidth: '480px', margin: '0 auto' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger)', marginBottom: '1rem' }}>
                            Oups, un problème est survenu.
                        </h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                            Une erreur inattendue s'est produite dans l'application.
                            {this.state.error && (
                                <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                                    {this.state.error.message}
                                </span>
                            )}
                        </p>
                        <button
                            className="btn btn--primary"
                            onClick={() => window.location.href = '/'}
                            style={{ padding: '10px 24px', borderRadius: '12px' }}
                        >
                            Retour à l'accueil
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
