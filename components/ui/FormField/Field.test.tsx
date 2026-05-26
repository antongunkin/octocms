import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Field } from './Field';

afterEach(() => {
  cleanup();
});

describe('Field', () => {
  it('renders label, schema badge, required marker, hint, and error', () => {
    render(
      <Field label="Title" htmlFor="title" schema="string" required hint="Shown in lists" error="Required">
        <input id="title" />
      </Field>,
    );

    expect(screen.getByText('Title')).toBeDefined();
    expect(screen.getByText('*')).toBeDefined();
    expect(screen.getByText('string')).toBeDefined();
    expect(screen.getByText('Shown in lists')).toBeDefined();
    expect(screen.getByText('Required')).toBeDefined();
  });

  it('renders children without hint or error when omitted', () => {
    render(
      <Field label="Body">
        <textarea aria-label="Body input" />
      </Field>,
    );

    expect(screen.getByLabelText('Body input')).toBeDefined();
    expect(screen.queryByText('Required')).toBeNull();
  });
});
