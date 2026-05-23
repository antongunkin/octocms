import { cleanup, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Toast, ToastAction, ToastClose, ToastDescription, ToastTitle, ToastViewport } from './toast';

afterEach(cleanup);

// ── Toast ─────────────────────────────────────────────────────────────────────

describe('Toast', () => {
  it('renders an li element', () => {
    render(<Toast>msg</Toast>);
    expect(screen.getByRole('status').tagName.toLowerCase()).toBe('li');
  });

  it('has data-state="open" by default', () => {
    render(<Toast>msg</Toast>);
    expect(screen.getByRole('status').getAttribute('data-state')).toBe('open');
  });

  it('has data-state="closed" when open={false}', () => {
    render(<Toast open={false}>msg</Toast>);
    expect(screen.getByRole('status').getAttribute('data-state')).toBe('closed');
  });

  it('has octo-toast class', () => {
    render(<Toast>msg</Toast>);
    expect(screen.getByRole('status').className).toContain('octo-toast');
  });

  it('destructive variant adds octo-toast--destructive class', () => {
    render(<Toast variant="destructive">msg</Toast>);
    expect(screen.getByRole('status').className).toContain('octo-toast--destructive');
  });

  it('success variant adds octo-toast--success class', () => {
    render(<Toast variant="success">msg</Toast>);
    expect(screen.getByRole('status').className).toContain('octo-toast--success');
  });

  it('default variant does not add variant modifier', () => {
    render(<Toast>msg</Toast>);
    const cls = screen.getByRole('status').className;
    expect(cls).not.toContain('octo-toast--default');
    expect(cls).not.toContain('octo-toast--destructive');
    expect(cls).not.toContain('octo-toast--success');
  });

  it('forwards extra className', () => {
    render(<Toast className="extra">msg</Toast>);
    expect(screen.getByRole('status').className).toContain('extra');
  });
});

// ── ToastTitle ────────────────────────────────────────────────────────────────

describe('ToastTitle', () => {
  it('renders with octo-toast__title class', () => {
    render(<ToastTitle>My title</ToastTitle>);
    expect(screen.getByText('My title').className).toContain('octo-toast__title');
  });
});

// ── ToastDescription ──────────────────────────────────────────────────────────

describe('ToastDescription', () => {
  it('renders with octo-toast__description class', () => {
    render(<ToastDescription>Some desc</ToastDescription>);
    expect(screen.getByText('Some desc').className).toContain('octo-toast__description');
  });
});

// ── ToastClose ────────────────────────────────────────────────────────────────

describe('ToastClose', () => {
  it('renders a button with aria-label', () => {
    render(<ToastClose />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toBeTruthy();
  });

  it('has octo-toast__close class', () => {
    render(<ToastClose />);
    expect(screen.getByRole('button').className).toContain('octo-toast__close');
  });
});

// ── ToastAction ───────────────────────────────────────────────────────────────

describe('ToastAction', () => {
  it('renders a button with octo-toast__action class', () => {
    render(<ToastAction>Undo</ToastAction>);
    const btn = screen.getByRole('button', { name: 'Undo' });
    expect(btn.className).toContain('octo-toast__action');
  });
});

// ── ToastViewport ─────────────────────────────────────────────────────────────

describe('ToastViewport', () => {
  it('renders an ol with aria-live="polite"', () => {
    render(<ToastViewport />);
    const ol = document.querySelector('ol');
    expect(ol).not.toBeNull();
    expect(ol!.getAttribute('aria-live')).toBe('polite');
  });

  it('has octo-toast__viewport class', () => {
    render(<ToastViewport />);
    expect(document.querySelector('ol')!.className).toContain('octo-toast__viewport');
  });
});
