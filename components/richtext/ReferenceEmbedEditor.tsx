'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Icon } from '../ui';
import type { JsxEditorProps } from '@mdxeditor/editor';
import { useMdastNodeUpdater } from '@mdxeditor/editor';

import type { Config } from '../../admin/types';
import { useConfig } from '../../hooks/useConfig';
import { useEntryList } from '../../admin/query/hooks/useEntryList';
import type { EntryListItem } from '../../types';
import { toReferenceKey } from '../../lib/referenceKeys';

/**
 * WYSIWYG editor component for `<CmsRef>` JSX embeds inside richtext fields.
 *
 * Shows a preview of the selected entry (title + collection type) and provides a
 * dialog to search and select an entry from configured collections.
 */
const ReferenceEmbedEditor: React.FC<JsxEditorProps> = ({ mdastNode }) => {
  const config = useConfig();
  const updateNode = useMdastNodeUpdater();

  // Read current attributes
  const idAttr = mdastNode.attributes?.find((a: any) => a.type === 'mdxJsxAttribute' && a.name === 'id');
  const displayAttr = mdastNode.attributes?.find((a: any) => a.type === 'mdxJsxAttribute' && a.name === 'display');
  const currentId = typeof idAttr?.value === 'string' ? idAttr.value : '';
  const currentDisplay = typeof displayAttr?.value === 'string' ? displayAttr.value : 'block';

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);

  const {
    data: entries = [],
    isPending: listPending,
    isFetched,
    refetch,
  } = useEntryList(undefined, { enabled: Boolean(isOpen || currentId) });

  useEffect(() => {
    if (!isOpen) return;
    void refetch();
  }, [isOpen, refetch]);

  // Find selected entry from the list once loaded (use content path — `id` is already `post-123`-style stem)
  const selectedEntry = useMemo(() => {
    if (!currentId) return null;
    const refKey = toReferenceKey(currentId);
    return entries.find((e) => toReferenceKey(e.path) === refKey) ?? null;
  }, [currentId, entries]);

  const updateAttributes = useCallback(
    (id: string, display: string) => {
      updateNode({
        attributes: [
          { type: 'mdxJsxAttribute', name: 'id', value: id },
          { type: 'mdxJsxAttribute', name: 'display', value: display },
        ],
      } as any);
    },
    [updateNode],
  );

  const handleSelect = useCallback(
    (entry: EntryListItem) => {
      const refKey = toReferenceKey(entry.path);
      updateAttributes(refKey, currentDisplay);
      setIsOpen(false);
      setSearchQuery('');
    },
    [updateAttributes, currentDisplay],
  );

  const handleClear = useCallback(() => {
    updateAttributes('', currentDisplay);
  }, [updateAttributes, currentDisplay]);

  const toggleDisplay = useCallback(() => {
    const newDisplay = currentDisplay === 'inline' ? 'block' : 'inline';
    updateAttributes(currentId, newDisplay);
  }, [updateAttributes, currentId, currentDisplay]);

  // Filter entries by search + collection
  const filteredEntries = useMemo(() => {
    let filtered = entries;
    if (collectionFilter) {
      filtered = filtered.filter((e) => e.type === collectionFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((e) => e.title.toLowerCase().includes(q) || e.type.toLowerCase().includes(q));
    }
    return filtered;
  }, [entries, collectionFilter, searchQuery]);

  // Unique collection types in the entry list
  const availableCollections = useMemo(() => [...new Set(entries.map((e) => e.type))], [entries]);

  const getCollectionLabel = (type: string) => config.collections[type as keyof Config['collections']]?.label || type;

  return (
    <div className="octo-ref-embed" contentEditable={false}>
      {currentId && selectedEntry ? (
        <div className="octo-ref-embed__selected">
          <div className="octo-ref-embed__icon-wrap">
            <Icon.FileText className="octo-icon-lg octo-u-text-brand" />
          </div>
          <div className="octo-ref-embed__info">
            <span className="octo-ref-embed__info-label">Reference embed · {currentDisplay}</span>
            <span className="octo-ref-embed__info-title">{selectedEntry.title}</span>
            <span className="octo-ref-embed__info-type">{getCollectionLabel(selectedEntry.type)}</span>
          </div>
          <div className="octo-ref-embed__actions">
            <button
              type="button"
              onClick={toggleDisplay}
              className="octo-ref-embed__action-btn"
              title={`Switch to ${currentDisplay === 'inline' ? 'block' : 'inline'} display`}
            >
              <Icon.Link2 className="octo-icon-sm" />
            </button>
            <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
              Change
            </Button>
            <button
              type="button"
              onClick={handleClear}
              className="octo-ref-embed__action-btn octo-ref-embed__action-btn--danger"
              title="Remove reference"
            >
              <Icon.X className="octo-icon-sm" />
            </button>
          </div>
        </div>
      ) : currentId && !selectedEntry ? (
        <div className="octo-ref-embed__loading">
          <div className="octo-ref-embed__loading-icon">
            <Icon.FileText className="octo-icon-lg octo-u-text-muted" />
          </div>
          <div className="octo-u-flex-1">
            <span className="octo-ref-embed__loading-text">
              {isFetched && !listPending ? 'Referenced entry not found' : 'Loading…'}
            </span>
            <span className="octo-ref-embed__loading-id">{currentId}</span>
          </div>
          <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
            Select entry
          </Button>
        </div>
      ) : (
        <div className="octo-ref-embed__empty-state">
          <div className="octo-ref-embed__loading-icon">
            <Icon.FileText className="octo-icon-lg octo-u-text-muted" />
          </div>
          <div>
            <span className="octo-ref-embed__loading-text octo-u-mb-1">No entry selected</span>
            <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
              Select entry
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setSearchQuery('');
            setCollectionFilter(null);
          }
        }}
      >
        <DialogContent className="octo-dialog-content octo-dialog-content--3xl octo-dialog-content--vh-80 octo-dialog-content--flex-col">
          <DialogHeader>
            <DialogTitle>Select entry to embed</DialogTitle>
          </DialogHeader>

          {/* Search + filter bar */}
          <div className="octo-ref-embed__search-row">
            <div className="octo-ref-embed__search-wrap">
              <Icon.Search className="octo-icon-md octo-u-text-muted octo-ref-embed__search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter entries…"
                className="octo-ff-reference__search-input"
              />
            </div>
            <select
              value={collectionFilter ?? ''}
              onChange={(e) => setCollectionFilter(e.target.value || null)}
              className="octo-media-asset__input"
            >
              <option value="">All collections</option>
              {availableCollections.map((type) => (
                <option key={type} value={type}>
                  {getCollectionLabel(type)}
                </option>
              ))}
            </select>
          </div>

          {/* Entry list */}
          <div className="octo-ref-embed__list">
            {listPending && entries.length === 0 ? (
              <div className="octo-ref-embed__empty">Loading entries…</div>
            ) : filteredEntries.length === 0 ? (
              <div className="octo-ref-embed__empty">{searchQuery ? 'No matching entries' : 'No entries found'}</div>
            ) : (
              <div className="octo-ref-embed__divider">
                {filteredEntries.map((entry) => {
                  const refKey = toReferenceKey(entry.path);
                  const isSelected = refKey === toReferenceKey(currentId);
                  return (
                    <button
                      key={`${entry.type}-${entry.id}`}
                      type="button"
                      onClick={() => handleSelect(entry)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: isSelected ? 'color-mix(in oklab, var(--brand) 10%, transparent)' : 'transparent',
                        color: isSelected ? 'var(--brand)' : 'var(--text)',
                        border: 0,
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <Icon.FileText className="octo-icon-md octo-u-shrink-0 octo-u-text-muted" />
                      <div className="octo-ref-embed__entry-info">
                        <div className="octo-ref-embed__entry-title">{entry.title}</div>
                        <div className="octo-ref-embed__entry-meta">{getCollectionLabel(entry.type)}</div>
                      </div>
                      {isSelected && <span className="octo-ref-embed__selected-badge">Selected</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReferenceEmbedEditor;
