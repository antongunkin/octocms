// CommandK — global ⌘K palette overlay.
// Result sections: entries (`searchEntries`) + branches (`listCMSBranches`)
// + a static Actions list. Media + Content Model search are out of scope.
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bot, FileText, GitBranch, Plus, Search } from 'lucide-react';

import { listCMSBranches, searchEntries, type CMSBranch, type SearchResult } from '../../admin/actions';
import { entryAdminHref } from '../../lib/searchIndex';
import { Kbd } from '../ui';
import { RowItem, Section } from './parts';

type CommandKProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function useCommandK() {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { open, setOpen };
}

type Action = {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  kbd?: string[];
};

const ACTIONS: Action[] = [
  { id: 'new-entry', label: 'New entry', icon: <Plus size={14} />, href: '/cms/content', kbd: ['⌘', 'N'] },
  { id: 'agent', label: 'Ask the agent', icon: <Bot size={14} />, href: '/cms/chat', kbd: ['⌘', 'J'] },
];

type Row =
  | { kind: 'entry'; result: SearchResult }
  | { kind: 'branch'; branch: CMSBranch }
  | { kind: 'action'; action: Action };

export function CommandK({ open, onOpenChange }: CommandKProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [entries, setEntries] = React.useState<SearchResult[]>([]);
  const [branches, setBranches] = React.useState<CMSBranch[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Reset state when palette opens; focus input.
  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setEntries([]);
    setActiveIndex(0);
    listCMSBranches()
      .then(setBranches)
      .catch(() => setBranches([]));
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Debounced entry search.
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setEntries([]);
      return;
    }
    const timer = setTimeout(() => {
      searchEntries(q)
        .then(setEntries)
        .catch(() => setEntries([]));
    }, 120);
    return () => clearTimeout(timer);
  }, [query, open]);

  // Build flat row list for keyboard navigation.
  const matchingBranches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches.slice(0, 5);
    return branches.filter((b) => b.branch.toLowerCase().includes(q)).slice(0, 5);
  }, [branches, query]);

  const matchingActions = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ACTIONS;
    return ACTIONS.filter((a) => a.label.toLowerCase().includes(q));
  }, [query]);

  const rows: Row[] = React.useMemo(
    () => [
      ...entries.map((r): Row => ({ kind: 'entry', result: r })),
      ...matchingBranches.map((b): Row => ({ kind: 'branch', branch: b })),
      ...matchingActions.map((a): Row => ({ kind: 'action', action: a })),
    ],
    [entries, matchingBranches, matchingActions],
  );

  React.useEffect(() => {
    if (activeIndex >= rows.length) setActiveIndex(0);
  }, [rows.length, activeIndex]);

  const runRow = React.useCallback(
    (row: Row, modifier?: boolean) => {
      onOpenChange(false);
      if (row.kind === 'entry') {
        // Always open the entry editor — never the public URL.
        router.push(entryAdminHref(row.result));
      } else if (row.kind === 'branch') {
        if (row.branch.prUrl && modifier) window.open(row.branch.prUrl, '_blank');
      } else if (row.action.href) {
        router.push(row.action.href);
      }
    },
    [onOpenChange, router],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onOpenChange(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[activeIndex];
      if (row) runRow(row, e.metaKey || e.ctrlKey);
    }
  };

  if (!open) return null;

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={() => onOpenChange(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onOpenChange(false);
      }}
    >
      <div
        className="w-full max-w-[720px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-1)]"
        style={{ boxShadow: 'var(--shadow-3)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3.5">
          <Search size={18} className="text-[var(--muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search entries, branches…"
            className="flex-1 border-0 bg-transparent text-base text-[var(--text)] outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          {entries.length > 0 && (
            <Section label={`Entries · ${entries.length}`}>
              {entries.map((r) => {
                runningIndex += 1;
                const idx = runningIndex;
                const adminHref = entryAdminHref(r);
                return (
                  <RowItem
                    key={`e-${r.id}`}
                    icon={<FileText size={14} />}
                    title={r.title}
                    sub={adminHref}
                    badge={r.typeLabel}
                    active={idx === activeIndex}
                    href={adminHref}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => onOpenChange(false)}
                  />
                );
              })}
            </Section>
          )}

          {matchingBranches.length > 0 && (
            <Section label={`Branches · ${matchingBranches.length}`}>
              {matchingBranches.map((b) => {
                runningIndex += 1;
                const idx = runningIndex;
                return (
                  <RowItem
                    key={`b-${b.branch}`}
                    icon={<GitBranch size={14} />}
                    title={b.branch}
                    sub={b.isPublished ? 'Published · live' : b.prUrl ? 'Open PR' : 'Branch'}
                    mono
                    active={idx === activeIndex}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={(e) => runRow({ kind: 'branch', branch: b }, e.metaKey || e.ctrlKey)}
                  />
                );
              })}
            </Section>
          )}

          {matchingActions.length > 0 && (
            <Section label="Actions">
              {matchingActions.map((a) => {
                runningIndex += 1;
                const idx = runningIndex;
                return (
                  <RowItem
                    key={`a-${a.id}`}
                    icon={a.icon}
                    title={a.label}
                    kbd={a.kbd}
                    active={idx === activeIndex}
                    href={a.href}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => onOpenChange(false)}
                  />
                );
              })}
            </Section>
          )}

          {rows.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              {query.trim() ? 'No results' : 'Start typing to search…'}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>↵</Kbd> open
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd> open in new tab
          </span>
        </div>
      </div>
    </div>
  );
}
