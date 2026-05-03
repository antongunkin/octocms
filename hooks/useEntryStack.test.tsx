import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toast } from './useToast';
import { EntryStackProvider, useEntryStack } from './useEntryStack';

const push = vi.fn();
const replace = vi.fn();
const back = vi.fn();

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
  useRouter: () => ({ push, replace, back }),
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
  const { stack, pushEntry, popEntry, closeAll, refreshTick, bumpRefresh } = useEntryStack();
  return (
    <div>
      <span data-testid="stack-len">{stack.length}</span>
      <span data-testid="stack-paths">{stack.map((e) => e.path).join('|')}</span>
      <span data-testid="stack-ids">{stack.map((e) => e.id).join('|')}</span>
      <span data-testid="refresh-tick">{refreshTick}</span>
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
        data-testid="push-grandchild"
        onClick={() =>
          pushEntry({
            id: 'gc-id',
            type: 'role',
            path: 'cms/content/role/role-gc.json',
            title: 'Grandchild',
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
      <button type="button" data-testid="bump" onClick={() => bumpRefresh()} />
    </div>
  );
}

describe('EntryStackProvider / useEntryStack', () => {
  beforeEach(() => {
    cleanup();
    push.mockReset();
    replace.mockReset();
    back.mockReset();
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

  it('pushEntry appends ?overlay=<path> via router.push (not replace)', async () => {
    render(
      <EntryStackProvider rootEntry={rootEntry}>
        <StackHarness />
      </EntryStackProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('push-child'));
    });

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('?overlay=cms%2Fcontent%2Fauthor%2Fauthor-child.json', { scroll: false });
      expect(replace).not.toHaveBeenCalled();
    });
  });

  it('pushEntry blocks duplicate paths and shows a toast', async () => {
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
    expect(push).not.toHaveBeenCalled();
  });

  it('popEntry replaces the URL with one fewer overlay= param (works for direct visits too)', async () => {
    setSearchString('overlay=cms/content/author/author-a.json&overlay=cms/content/post/post-b.json');
    render(
      <EntryStackProvider rootEntry={rootEntry}>
        <StackHarness />
      </EntryStackProvider>,
    );
    expect(screen.getByTestId('stack-len').textContent).toBe('3');

    await act(async () => {
      fireEvent.click(screen.getByTestId('pop'));
    });

    expect(replace).toHaveBeenCalledWith('?overlay=cms%2Fcontent%2Fauthor%2Fauthor-a.json', { scroll: false });
    expect(push).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it('popEntry falls back to pathname when the last overlay is removed', async () => {
    setSearchString('overlay=cms/content/author/author-only.json');
    render(
      <EntryStackProvider rootEntry={rootEntry}>
        <StackHarness />
      </EntryStackProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('pop'));
    });

    expect(replace).toHaveBeenCalledWith('/cms/edit', { scroll: false });
  });

  it('closeAll removes every overlay= param via router.replace', async () => {
    setSearchString('overlay=cms/content/author/author-a.json&overlay=cms/content/post/post-b.json&keep=1');
    render(
      <EntryStackProvider rootEntry={rootEntry}>
        <StackHarness />
      </EntryStackProvider>,
    );

    expect(screen.getByTestId('stack-len').textContent).toBe('3');

    await act(async () => {
      fireEvent.click(screen.getByTestId('close-all'));
    });

    expect(replace).toHaveBeenCalledWith('?keep=1', { scroll: false });
  });

  it('closeAll falls back to pathname when no params remain', async () => {
    setSearchString('overlay=cms/content/author/author-a.json');
    render(
      <EntryStackProvider rootEntry={rootEntry}>
        <StackHarness />
      </EntryStackProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('close-all'));
    });

    expect(replace).toHaveBeenCalledWith('/cms/edit', { scroll: false });
  });

  it('hydrates the stack from repeated ?overlay= params on mount (no effect needed)', () => {
    setSearchString('overlay=cms/content/author/author-a.json&overlay=cms/content/role/role-b.json');

    render(
      <EntryStackProvider rootEntry={rootEntry}>
        <StackHarness />
      </EntryStackProvider>,
    );

    expect(screen.getByTestId('stack-len').textContent).toBe('3');
    expect(screen.getByTestId('stack-ids').textContent).toBe('root-id|a|b');
    expect(screen.getByTestId('stack-paths').textContent).toBe(
      'cms/content/post/post-root.json|cms/content/author/author-a.json|cms/content/role/role-b.json',
    );
  });

  it('bumpRefresh increments refreshTick observed by subscribers', async () => {
    render(
      <EntryStackProvider rootEntry={rootEntry}>
        <StackHarness />
      </EntryStackProvider>,
    );

    expect(screen.getByTestId('refresh-tick').textContent).toBe('0');

    await act(async () => {
      fireEvent.click(screen.getByTestId('bump'));
    });
    expect(screen.getByTestId('refresh-tick').textContent).toBe('1');

    await act(async () => {
      fireEvent.click(screen.getByTestId('bump'));
    });
    expect(screen.getByTestId('refresh-tick').textContent).toBe('2');
  });

  it('two pushEntry calls compose into ?overlay=&overlay=', async () => {
    setSearchString('overlay=cms/content/author/author-child.json');

    render(
      <EntryStackProvider rootEntry={rootEntry}>
        <StackHarness />
      </EntryStackProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('push-grandchild'));
    });

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '?overlay=cms%2Fcontent%2Fauthor%2Fauthor-child.json&overlay=cms%2Fcontent%2Frole%2Frole-gc.json',
        { scroll: false },
      );
    });
  });
});
