'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { toContentPath } from '../lib/referenceKeys';
import { toast } from './useToast';

export type EntryStackEntry = {
  /** Entry UUID */
  id: string;
  /** Collection name */
  type: string;
  /** Content file path (e.g. 'cms/content/author/author-abc.json') */
  path: string;
  /** Display title — may be empty when hydrated from URL; InlineEntryEditor fills it after `getFile` resolves. */
  title: string;
};

type EntryStackContextValue = {
  stack: EntryStackEntry[];
  pushEntry: (entry: EntryStackEntry) => void;
  popEntry: () => void;
  closeAll: () => void;
  /** O(1) cycle detection — content paths of all entries currently in the stack */
  ancestorPaths: Set<string>;
  /** Increments when an overlay closes after a successful save/delete; subscribers re-run their data effects. */
  refreshTick: number;
  /** Called by `InlineEntryEditor` on close when its `dirtyRef` is set. */
  bumpRefresh: () => void;
};

const EntryStackContext = createContext<EntryStackContextValue>({
  stack: [],
  pushEntry: () => {},
  popEntry: () => {},
  closeAll: () => {},
  ancestorPaths: new Set(),
  refreshTick: 0,
  bumpRefresh: () => {},
});

const OVERLAY_PARAM = 'overlay';

const deriveEntryFromPath = (path: string): EntryStackEntry | null => {
  // Path shape: cms/content/<type>/<type>-<id>.json
  const match = path.match(/^cms\/content\/([^/]+)\/([^/]+)\.json$/);
  if (!match) return null;
  const [, type, fileStem] = match;
  const id = fileStem.startsWith(`${type}-`) ? fileStem.slice(type.length + 1) : fileStem;
  return { id, type, path, title: '' };
};

export const EntryStackProvider = ({
  children,
  rootEntry,
}: {
  children: React.ReactNode;
  rootEntry: EntryStackEntry;
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [refreshTick, setRefreshTick] = useState(0);

  // Stack is fully derived from the URL — no internal state, no init effect, no placeholders.
  const overlayStack = useMemo<EntryStackEntry[]>(() => {
    const paths = searchParams.getAll(OVERLAY_PARAM);
    return paths.map((p) => deriveEntryFromPath(p)).filter((e): e is EntryStackEntry => e !== null);
  }, [searchParams]);

  const stack = useMemo(() => [rootEntry, ...overlayStack], [rootEntry, overlayStack]);

  const ancestorPaths = useMemo(() => {
    const set = new Set<string>();
    if (rootEntry.path) set.add(rootEntry.path);
    for (const e of overlayStack) set.add(e.path);
    return set;
  }, [rootEntry.path, overlayStack]);

  const pushEntry = useCallback(
    (entry: EntryStackEntry) => {
      // Normalise the path — `FormReferenceField` already passes a full content path, but
      // `LinkedBySection` may pass entries with raw paths from `EntryListItem` that we need to keep stable.
      const path = entry.path && entry.path.startsWith('cms/content/') ? entry.path : toContentPath(entry.path);
      if (!path) {
        toast({ title: 'Cannot open inline editor — invalid entry path', variant: 'destructive' });
        return;
      }
      if (ancestorPaths.has(path)) {
        toast({ title: 'Circular reference — this entry is already open in the stack', variant: 'destructive' });
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      params.append(OVERLAY_PARAM, path);
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [ancestorPaths, router, searchParams],
  );

  // Removes the last `overlay=` param. Works whether the overlay was pushed in-app or arrived via a
  // direct URL visit. Browser back also closes one overlay because each `pushEntry` did a `router.push`.
  const popEntry = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    const overlays = params.getAll(OVERLAY_PARAM);
    if (overlays.length === 0) return;
    params.delete(OVERLAY_PARAM);
    for (const p of overlays.slice(0, -1)) params.append(OVERLAY_PARAM, p);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [router, searchParams]);

  const closeAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(OVERLAY_PARAM);
    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : window.location.pathname;
    router.replace(newUrl, { scroll: false });
  }, [router, searchParams]);

  const bumpRefresh = useCallback(() => {
    setRefreshTick((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({ stack, pushEntry, popEntry, closeAll, ancestorPaths, refreshTick, bumpRefresh }),
    [stack, pushEntry, popEntry, closeAll, ancestorPaths, refreshTick, bumpRefresh],
  );

  return <EntryStackContext.Provider value={value}>{children}</EntryStackContext.Provider>;
};

export const useEntryStack = (): EntryStackContextValue => useContext(EntryStackContext);
