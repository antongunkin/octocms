'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'octocms:media-custom-folders';

function readStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeStorage(values: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    /* quota / private mode — silently ignore */
  }
}

/**
 * Persists the user-created virtual "folders" (really tags for visual sorting)
 * across navigation. Folders aren't physical directories; they're just labels
 * stored as a single `folder` string on each media entry. This hook lets the
 * sidebar remember tags the user invented even when no asset is yet assigned
 * to them, so navigating into an asset edit page and back doesn't wipe them.
 */
export function useMediaCustomFolders() {
  const [folders, setFolders] = useState<string[]>([]);

  useEffect(() => {
    setFolders(readStorage());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setFolders(readStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((name: string) => {
    setFolders((prev) => {
      if (prev.includes(name)) return prev;
      const next = [...prev, name];
      writeStorage(next);
      return next;
    });
  }, []);

  const remove = useCallback((name: string) => {
    setFolders((prev) => {
      const next = prev.filter((f) => f !== name);
      writeStorage(next);
      return next;
    });
  }, []);

  return { folders, add, remove };
}
