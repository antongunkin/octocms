import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminErrorView } from './AdminErrorView';
import { ContentSourceError } from '../../lib/contentSourceError';

afterEach(() => {
  cleanup();
});

describe('AdminErrorView', () => {
  it('renders a generic error message when given a plain Error', () => {
    render(<AdminErrorView error={new Error('boom')} reset={() => {}} />);
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    // Generic message text is shown (no parsed userMessage).
    expect(screen.getByText(/an unexpected error occurred/i)).toBeTruthy();
  });

  it('uses ContentSourceError.userMessage when given a parsed instance', () => {
    const err = new ContentSourceError('github_auth', 'Token missing — set CMS_GITHUB_TOKEN.');
    render(<AdminErrorView error={err} reset={() => {}} />);
    expect(screen.getByText(/token missing/i)).toBeTruthy();
  });

  it('shows the "try again later" hint for availability errors', () => {
    const err = new ContentSourceError('github_unavailable', 'GitHub is temporarily unavailable.');
    render(<AdminErrorView error={err} reset={() => {}} />);
    expect(screen.getByText(/try again in a few minutes/i)).toBeTruthy();
  });

  it('does not show the availability hint for auth errors', () => {
    const err = new ContentSourceError('github_auth', 'Token missing.');
    render(<AdminErrorView error={err} reset={() => {}} />);
    expect(screen.queryByText(/try again in a few minutes/i)).toBeNull();
  });

  it('parses userMessage from a serialized error message', () => {
    // Serialized form: ContentSourceError.message has the `CMS_PUBLIC:` prefix.
    const err = new Error('CMS_PUBLIC:github_rate_limit:Rate limit exceeded.');
    render(<AdminErrorView error={err} reset={() => {}} />);
    expect(screen.getByText(/rate limit exceeded/i)).toBeTruthy();
    expect(screen.getByText(/try again in a few minutes/i)).toBeTruthy();
  });

  it('clicking "Try again" calls reset', () => {
    const reset = vi.fn();
    render(<AdminErrorView error={new Error('boom')} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('renders the digest reference when present', () => {
    const err = Object.assign(new Error('boom'), { digest: 'digest-xyz' });
    render(<AdminErrorView error={err} reset={() => {}} />);
    expect(screen.getByText(/reference: digest-xyz/i)).toBeTruthy();
  });

  it('renders a back link with the configured href and label', () => {
    render(<AdminErrorView error={new Error('boom')} reset={() => {}} backHref="/cms/content" backLabel="Content" />);
    const link = screen.getByRole('link', { name: 'Content' });
    expect(link.getAttribute('href')).toBe('/cms/content');
  });
});
