'use client';

import React from 'react';

import { Button } from './ui';
import { cn } from '../lib/utils';

type FallbackRenderProps = {
  error: Error;
  reset: () => void;
};

type ErrorBoundaryProps = {
  children: React.ReactNode;
  /** Custom fallback. Either a node or a render fn taking `{ error, reset }`. */
  fallback?: React.ReactNode | ((props: FallbackRenderProps) => React.ReactNode);
  /** Called when the user clicks "Try again" or `resetKeys` change. */
  onReset?: () => void;
  /** Auto-reset boundary state when any of these values change. */
  resetKeys?: ReadonlyArray<unknown>;
  /** Optional label rendered in the default fallback ("This <label> failed to load"). */
  label?: string;
  /** Optional className to merge into the default fallback wrapper. */
  className?: string;
};

type ErrorBoundaryState = { error: Error | null };

function arraysShallowEqual(a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys } = this.props;
    if (this.state.error && resetKeys && prevProps.resetKeys && !arraysShallowEqual(prevProps.resetKeys, resetKeys)) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) {
      const { children } = this.props;
      if (children == null) return null;
      if (React.Children.count(children) <= 1) return children;
      return <>{React.Children.toArray(children)}</>;
    }

    const { fallback, label, className } = this.props;
    if (typeof fallback === 'function') {
      return fallback({ error, reset: this.reset });
    }
    if (fallback !== undefined) {
      return fallback;
    }
    return <DefaultBoundaryFallback error={error} reset={this.reset} label={label} className={className} />;
  }
}

function DefaultBoundaryFallback({
  error,
  reset,
  label,
  className,
}: {
  error: Error;
  reset: () => void;
  label?: string;
  className?: string;
}) {
  const heading = label ? `This ${label} failed to load` : 'This section failed to load';
  return (
    <div role="alert" className={cn('octo-error-boundary', className)}>
      <p className="octo-error-boundary__title">{heading}</p>
      <p className="octo-error-boundary__msg">{error.message || 'An unexpected error occurred.'}</p>
      <div>
        <Button type="button" variant="outline" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
