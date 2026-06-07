import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('🔴 ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          fontFamily: 'Arial',
          fontSize: '16px',
          lineHeight: '1.6',
          maxWidth: '600px',
          margin: '0 auto',
        }}>
          <h1 style={{ color: '#d66f7d' }}>❌ שגיאה באפליקציה</h1>
          <p><strong>ההודעה:</strong></p>
          <pre style={{
            background: '#f5f5f5',
            padding: '16px',
            borderRadius: '8px',
            overflow: 'auto',
            fontSize: '13px',
          }}>
            {this.state.error?.message || 'Unknown error'}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#4da7a0',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            🔄 רענן את העמוד
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
