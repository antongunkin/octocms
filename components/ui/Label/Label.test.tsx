import { cleanup, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Label } from './Label';

afterEach(cleanup);

describe('Label', () => {
  it('renders a <label> element', () => {
    render(<Label>Name</Label>);
    expect(screen.getByText('Name').tagName).toBe('LABEL');
  });

  it('has octo-label class', () => {
    render(<Label>Name</Label>);
    expect(screen.getByText('Name').className).toContain('octo-label');
  });

  it('passes htmlFor to the underlying label', () => {
    render(<Label htmlFor="my-input">Name</Label>);
    expect(screen.getByText('Name').getAttribute('for')).toBe('my-input');
  });

  it('merges additional className', () => {
    render(<Label className="extra">Name</Label>);
    const el = screen.getByText('Name');
    expect(el.className).toContain('octo-label');
    expect(el.className).toContain('extra');
  });

  it('forwards ref to the label element', () => {
    const ref = React.createRef<HTMLLabelElement>();
    render(<Label ref={ref}>Name</Label>);
    expect(ref.current?.tagName).toBe('LABEL');
  });

  it('passes arbitrary HTML attributes through', () => {
    render(
      <Label data-testid="lbl" aria-label="field-label">
        Name
      </Label>,
    );
    expect(screen.getByTestId('lbl').getAttribute('aria-label')).toBe('field-label');
  });
});
