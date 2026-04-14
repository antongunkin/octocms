'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { toast } from './useToast';

export type EntryStackEntry = {
  /** Entry UUID */
  id: string;
  /** Collection name */
  type: string;
  /** Content file path (e.g. 'cms/content/author/author-abc.json') */
  path: string;
  /** Display title */
  title: string;
};

type EntryStackContextValue = {
  stack: EntryStackEntry[];
  pushEntry: (entry: EntryStackEntry) => void;
  popEntry: () => void;
  closeAll: () => void;
  /** O(1) cycle detection — IDs of all entries currently in the stack */
  ancestorIds: Set<string>;
};

const EntryStackContext = createContext<EntryStackContextValue>({
  stack: [],
  pushEntry: () => {},
  popEntry: () => {},
  closeAll: () => {},
  ancestorIds: new Set(),
});

export const EntryStackProvider = ({
  children,
  rootEntry,
}: {
  children: React.ReactNode;
  rootEntry: EntryStackEntry;
}) => {
  const [overlayStack, setOverlayStack] = useState<EntryStackEntry[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const initializedRef = useRef(false);

  // Full stack = root + overlays (root is always stack[0])
  const stack = useMemo(() => [rootEntry, ...overlayStack], [rootEntry, overlayStack]);

  const ancestorIds = useMemo(() => new Set(stack.map((e) => e.id)), [stack]);

  // Sync URL → state on mount (restore from ?editing=id1,id2)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const editingParam = searchParams.get('editing');
    if (!editingParam) return;

    // We store IDs in the URL; actual entry data will be loaded by InlineEntryEditor on mount
    const ids = editingParam.split(',').filter(Boolean);
    if (ids.length === 0) return;

    // Create placeholder stack entries — InlineEntryEditor will load the real data
    const placeholders: EntryStackEntry[] = ids.map((id) => ({
      id,
      type: '',
      path: '',
      title: 'Loading...',
    }));
    setOverlayStack(placeholders);
  }, [searchParams]);

  // Sync state → URL whenever overlay stack changes
  const syncUrl = useCallback(
    (newOverlays: EntryStackEntry[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newOverlays.length > 0) {
        params.set('editing', newOverlays.map((e) => e.id).join(','));
      } else {
        params.delete('editing');
      }
      const qs = params.toString();
      const newUrl = qs ? `?${qs}` : window.location.pathname;
      router.replace(newUrl, { scroll: false });
    },
    [router, searchParams],
  );

  const pushEntry = useCallback(
    (entry: EntryStackEntry) => {
      if (ancestorIds.has(entry.id)) {
        toast({ title: 'Circular reference — this entry is already open in the stack', variant: 'destructive' });
        return;
      }
      setOverlayStack((prev) => {
        const next = [...prev, entry];
        // Defer navigation: router.replace must not run inside the setState updater (still render phase).
        queueMicrotask(() => syncUrl(next));
        return next;
      });
    },
    [ancestorIds, syncUrl],
  );

  const popEntry = useCallback(() => {
    setOverlayStack((prev) => {
      const next = prev.slice(0, -1);
      queueMicrotask(() => syncUrl(next));
      return next;
    });
  }, [syncUrl]);

  const closeAll = useCallback(() => {
    setOverlayStack([]);
    syncUrl([]);
  }, [syncUrl]);

  const value = useMemo(
    () => ({ stack, pushEntry, popEntry, closeAll, ancestorIds }),
    [stack, pushEntry, popEntry, closeAll, ancestorIds],
  );

  return <EntryStackContext.Provider value={value}>{children}</EntryStackContext.Provider>;
};

export const useEntryStack = (): EntryStackContextValue => useContext(EntryStackContext);
