'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

export type SlashMenuItem = {
  key: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
};

type SlashMenuOverlayProps = {
  items: SlashMenuItem[];
  open: boolean;
  filter: string;
  position: { top: number; left: number } | null;
  onSelect: (item: SlashMenuItem) => void;
  onClose: () => void;
};

export function SlashMenuOverlay({ items, open, filter, position, onSelect, onClose }: SlashMenuOverlayProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Reset selection when filter or items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter, items.length]);

  // Scroll selected item into view
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % items.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (items[selectedIndex]) {
            onSelect(items[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [open, items, selectedIndex, onSelect, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!open || !position) return null;

  if (items.length === 0) {
    return (
      <div
        ref={menuRef}
        className="octo-slash-menu octo-slash-menu--empty"
        style={{ top: position.top, left: position.left }}
      >
        No matching commands
      </div>
    );
  }

  return (
    <div ref={menuRef} className="octo-slash-menu" style={{ top: position.top, left: position.left }}>
      {items.map((item, i) => (
        <button
          key={item.key}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          type="button"
          className={`octo-slash-menu__item${i === selectedIndex ? ' octo-slash-menu__item--active' : ''}`}
          onMouseEnter={() => setSelectedIndex(i)}
          onClick={() => onSelect(item)}
        >
          <span className="octo-slash-menu__item-icon">{item.icon}</span>
          <span>
            <span className="octo-slash-menu__item-label">{item.label}</span>
            {item.description && <span className="octo-slash-menu__item-desc">{item.description}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
