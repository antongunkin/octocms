'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

import type { SearchResult } from '../../lib/searchIndex';

/** Escape special regex characters in a string. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split text into alternating non-match/match segments and wrap matches in <mark>.
 * Uses prefix matching (term\w*) to support MiniSearch's prefix: true behavior.
 */
function highlightTerms(text: string, terms: string[]): React.ReactNode {
  const filtered = terms.filter((t) => t.length > 0);
  if (filtered.length === 0) return text;

  const pattern = filtered.map((t) => escapeRegex(t) + '\\w*').join('|');
  const parts = text.split(new RegExp(`(${pattern})`, 'gi'));

  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} style={{ background: '#fef08a', color: 'inherit', borderRadius: 2, padding: '0 2px' }}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export interface SearchBoxProps {
  placeholder?: string;
  className?: string;
}

export default function SearchBox({ placeholder = 'Search...', className = '' }: SearchBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Fetch search results
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      setSelectedIndex(-1);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
        setIsOpen(true);
        setSelectedIndex(-1);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    } catch {
      setResults([]);
      setIsOpen(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle input change with debounce
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          navigateToResult(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
      default:
        break;
    }
  };

  // Navigate to a result
  const navigateToResult = (result: SearchResult) => {
    window.location.href = result.url;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll selected result into view
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll('[data-result-item]');
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <div className={`octo-search-box${className ? ` ${className}` : ''}`}>
      <div className="octo-search-box__input-wrap">
        <Search className="octo-search-box__icon" size={18} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim() && results.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className="octo-search-box__input"
          autoComplete="off"
        />
        {query && (
          <button type="button" onClick={handleClear} className="octo-search-box__clear" aria-label="Clear search">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && (results.length > 0 || isSearching) && (
        <div ref={dropdownRef} className="octo-search-box__results">
          {isSearching && results.length === 0 && <div className="octo-search-box__searching">Searching...</div>}

          {results.length > 0 && (
            <ul className="octo-search-box__list">
              {results.map((result, index) => (
                <li
                  key={result.id}
                  data-result-item
                  className={`octo-search-box__result${index === selectedIndex ? ' octo-search-box__result--active' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => navigateToResult(result)}
                    className="octo-search-box__result-btn"
                  >
                    <div className="octo-search-box__result-top">
                      <span className="octo-search-box__result-title">
                        {highlightTerms(result.title, Object.keys(result.match))}
                      </span>
                      <span className="octo-search-box__result-badge">{result.typeLabel}</span>
                    </div>
                    {Object.values(result.match).flat().includes('content') && result.snippet && (
                      <p className="octo-search-box__result-snippet">
                        {highlightTerms(result.snippet, Object.keys(result.match))}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
