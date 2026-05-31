import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled error in component tree:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="vh-100 d-flex flex-column justify-content-center align-items-center text-center p-4">
          <h2 className="mb-3">Something went wrong.</h2>
          <p className="text-muted mb-4">Please refresh the page or contact support if the issue persists.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Refresh
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
