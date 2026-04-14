import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toast } from './useToast';
import { EntryStackProvider, useEntryStack } from './useEntryStack';

const replace = vi.fn();

const { getSearchString, setSearchString } = vi.hoisted(() => {
  let search = '';
  return {
    getSearchString: () => search,
    setSearchString: (next: string) => {
      search = next;
    },
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(getSearchString()),
}));

vi.mock('./useToast', () => ({
  toast: vi.fn(),
}));

const rootEntry = {
  id: 'root-id',
  type: 'post',
  path: 'cms/content/post/post-root.json',
  title: 'Root',
};

function StackHarness() {
  const { stack, pushEntry, popEntry, closeAll } = useEntryStack();
  return (
    <div>
      <span data-testid="stack-len">{stack.length}</span>
      <span data-testid="stack-ids">{stack.map((e) => e.id).join('|')}</span>
      <button
        type="button"
        data-testid="push-child"
        onClick={() =>
          pushEntry({
            id: 'child-id',
            type: 'author',
            path: 'cms/content/author/author-child.json',
            title: 'Child',
          })
        }
      />
      <button
        type="button"
        data-testid="push-dup-root"
        onClick={() =>
          pushEntry({
            id: 'root-id',
            type: 'post',
            path: 'cms/content/post/post-root.json',
            title: 'Dup',
          })
        }
      />
      <button type="button" data-testid="pop" onClick={() => popEntry()} />
      <button type="button" data-testid="close-all" onClick={() => closeAll()} />
    </div>
  );
}

describe('EntryStackProvider / useEntryStack', () => {
  beforeEach(() => {
    cleanup();
    replace.mockReset();
    setSearchString('');
    vi.mocked(toast).mockReset();
    vi.stubGlobal('location', { pathname: '/cms/edit' } as Pick<Location, 'pathname'>);
  });

  it('starts with only the root entry on the stack', () => {
    render(
      <EntryStackProvider rootEntry={rootEntry}>
        <StackHarness />
      </EntryStackProvider>,
    );

    expect(screen.getByTestId('stack-len').textContent).toBe('1');
    expect(screen.getByTestId('stack-ids').textContent).toBe('root-id');
  });

  it('pushEntry appends an overlay and updates the URL via router.replace', async () => {
    render(
      <EntryStackProvider rootEntry={rootEntry}>
        <StackHarness />
      </EntryStackProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('push-child'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('stack-len').textContent).toBe('2');
      expect(screen.getByTestId('stack-ids').textContent).toBe('root-id|child-id');
    });

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('?editing=child-id', { scroll: false });
    });
  });

  it('pushEntry does not add a duplicate id and shows a toast', async () => {
    render(
      <EntryStackProvider rootEntry={rootEntry}>
        <StackHarness />
      </EntryStackProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('push-dup-root'));
    });

    expect(screen.getByTestId('stack-len').textContent).toBe('1');
    expect(vi.mocked(toast)).toHaveBeenCalledWith({
      title: 'Circular reference — this entry is already open in the stack',
      variant: 'destructive',
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it('popEntry removes the top overlay and clears editing from the URL when empty', async () => {
    render(
      <EntryStackProvider rootEntry={rootEntry}>
        <StackHarness />
      </EntryStackProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('push-child'));
    });
    await waitFor(() => expect(screen.getByTestId('stack-len').textContent).toBe('2'));

    replace.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByTestId('pop'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('stack-len').textContent).toBe('1');
      expect(replace).toHaveBeenCalledWith('/cms/edit', { scroll: false });
    });
  });

  it('closeAll removes every overlay', async () => {
    render(
      <EntryStackProvider rootEntry={rootEntry}>
        <StackHarness />
      </EntryStackProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('push-child'));
    });
    await waitFor(() => expect(screen.getByTestId('stack-len').textContent).toBe('2'));

    replace.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByTestId('close-all'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('stack-len').textContent).toBe('1');
      expect(replace).toHaveBeenCalledWith('/cms/edit', { scroll: false });
    });
  });

  it('hydrates overlay placeholders from ?editing= in the URL on mount', async () => {
    setSearchString('editing=alpha,beta');

    render(
      <EntryStackProvider rootEntry={rootEntry}>
        <StackHarness />
      </EntryStackProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('stack-len').textContent).toBe('3');
      expect(screen.getByTestId('stack-ids').textContent).toBe('root-id|alpha|beta');
    });
  });
});
