import { act, cleanup, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ConditionalBranchesEditor from './ConditionalBranchesEditor';
import { fireDragReorder } from '../test/dndTestUtils';
import type { ConditionalBranchConfig } from '../../types';

const branches: ConditionalBranchConfig[] = [
  { key: 'a', label: 'Branch A', fields: {} },
  { key: 'b', label: 'Branch B', fields: {} },
  { key: 'c', label: 'Branch C', fields: {} },
];

function branchCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.octo-branch-card'));
}

function branchLabels(): string[] {
  return branchCards().map((card) => {
    const input = card.querySelector<HTMLInputElement>('input');
    return input?.value ?? '';
  });
}

function branchCardByLabel(label: string): HTMLElement {
  const card = branchCards().find((candidate) => {
    const input = candidate.querySelector<HTMLInputElement>('input');
    return input?.value === label;
  });
  if (!card) throw new Error(`No branch card for label "${label}"`);
  return card;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('ConditionalBranchesEditor drag-and-drop', () => {
  it('reorders branches on drop', async () => {
    const onChange = vi.fn();
    render(
      <ConditionalBranchesEditor
        branches={branches}
        onChange={onChange}
        availableCollections={['post']}
        onEditNestedField={vi.fn()}
      />,
    );

    expect(branchLabels()).toEqual(['Branch A', 'Branch B', 'Branch C']);

    await fireDragReorder(branchCardByLabel('Branch A'), branchCardByLabel('Branch C'));

    expect(onChange).toHaveBeenCalledWith([
      { key: 'b', label: 'Branch B', fields: {} },
      { key: 'c', label: 'Branch C', fields: {} },
      { key: 'a', label: 'Branch A', fields: {} },
    ]);
  });

  it('does not reorder when dropped onto the same branch', async () => {
    const onChange = vi.fn();
    render(
      <ConditionalBranchesEditor
        branches={branches}
        onChange={onChange}
        availableCollections={['post']}
        onEditNestedField={vi.fn()}
      />,
    );

    const card = branchCardByLabel('Branch B');
    await act(async () => {
      fireEvent.dragStart(card);
    });
    await act(async () => {
      fireEvent.drop(card);
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(branchLabels()).toEqual(['Branch A', 'Branch B', 'Branch C']);
  });

  it('does not start a drag when disabled', () => {
    render(
      <ConditionalBranchesEditor
        branches={branches}
        onChange={vi.fn()}
        availableCollections={['post']}
        onEditNestedField={vi.fn()}
        disabled
      />,
    );

    expect(branchCards()[0]?.getAttribute('draggable')).toBe('false');
  });
});
