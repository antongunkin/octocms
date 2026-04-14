'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

import { searchEntries, type SearchResult } from '../admin/actions/search';
import { cn } from '../lib/utils';

export default function SearchPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await searchEntries(q);
      setResults(res);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  // Group results by type
  const grouped = new Map<string, SearchResult[]>();
  for (const r of results) {
    const list = grouped.get(r.type);
    if (list) {
      list.push(r);
    } else {
      grouped.set(r.type, [r]);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search across all content..."
          className="w-full pl-10 pr-4 py-3 text-lg border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Searching...</div>
        )}
      </div>

      {!hasSearched && !query.trim() && (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-16">Type to search across all content</p>
      )}

      {hasSearched && results.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-16">No entries match your search</p>
      )}

      {grouped.size > 0 && (
        <div className="space-y-6">
          {[...grouped.entries()].map(([type, items]) => (
            <div key={type}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                {items[0].typeLabel}
              </h2>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {items.map((item) => {
                  // id format: "type/entryId"
                  const entryId = item.id.split('/').slice(1).join('/');
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => router.push(`/cms/${type}/${entryId}`)}
                        className={cn(
                          'w-full text-left px-4 py-3 flex items-center justify-between',
                          'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800',
                          'transition-colors cursor-pointer',
                        )}
                      >
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.title}</span>
                        <span className="ml-3 shrink-0 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 dark:text-gray-500 px-2 py-0.5 rounded">
                          {item.typeLabel}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
