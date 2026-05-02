import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';

afterEach(() => {
  cleanup();
});

function Boom({ shouldThrow, message = 'kaboom' }: { shouldThrow: boolean; message?: string }) {
  if (shouldThrow) throw new Error(message);
  return <span>healthy</span>;
}

describe('ErrorBoundary', () => {
  it('renders children on the happy path', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('healthy')).toBeTruthy();
  });

  it('renders default fallback when child throws', () => {
    // React logs caught errors to the console; suppress for clean test output.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary label="widget">
        <Boom shouldThrow message="kaboom" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/this widget failed to load/i)).toBeTruthy();
    expect(screen.getByText(/kaboom/)).toBeTruthy();
    errSpy.mockRestore();
  });

  it('reset clears the error state', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Toggle() {
      const [t, setT] = React.useState(true);
      return (
        <ErrorBoundary onReset={() => setT(false)}>
          <Boom shouldThrow={t} />
        </ErrorBoundary>
      );
    }
    render(<Toggle />);
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('healthy')).toBeTruthy();
    errSpy.mockRestore();
  });

  it('auto-resets when resetKeys change', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Wrapper({ shouldThrow, resetKey }: { shouldThrow: boolean; resetKey: number }) {
      return (
        <ErrorBoundary resetKeys={[resetKey]}>
          <Boom shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    }
    const { rerender } = render(<Wrapper shouldThrow resetKey={1} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    rerender(<Wrapper shouldThrow={false} resetKey={2} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('healthy')).toBeTruthy();
    errSpy.mockRestore();
  });

  it('renders a custom node fallback when provided', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<div>custom-node</div>}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText('custom-node')).toBeTruthy();
    errSpy.mockRestore();
  });

  it('renders a custom render-fn fallback and forwards reset', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Wrapper() {
      const [t, setT] = React.useState(true);
      return (
        <ErrorBoundary
          onReset={() => setT(false)}
          fallback={({ error, reset }) => (
            <div>
              <p>render-fn: {error.message}</p>
              <button type="button" onClick={reset}>
                custom-reset
              </button>
            </div>
          )}
        >
          <Boom shouldThrow={t} />
        </ErrorBoundary>
      );
    }
    render(<Wrapper />);
    expect(screen.getByText(/render-fn: kaboom/)).toBeTruthy();
    fireEvent.click(screen.getByText('custom-reset'));
    expect(screen.getByText('healthy')).toBeTruthy();
    errSpy.mockRestore();
  });
});
