'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Link2, Search, X } from 'lucide-react';
import type { JsxEditorProps } from '@mdxeditor/editor';
import { useMdastNodeUpdater } from '@mdxeditor/editor';

import type { Config } from '../../admin/types';
import { useConfig } from '../../hooks/useConfig';
import { useEntryList } from '../../admin/query/hooks/useEntryList';
import type { EntryListItem } from '../../types';
import { toReferenceKey } from '../../lib/referenceKeys';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui';

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
    <div className="my-2 rounded-lg border border-border bg-muted/30 p-3" contentEditable={false}>
      {currentId && selectedEntry ? (
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg border border-border bg-primary/10 flex items-center justify-center flex-none">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-0 pt-0.5">
            <span className="text-xs font-medium text-muted-foreground">Reference embed · {currentDisplay}</span>
            <span className="text-sm font-medium truncate">{selectedEntry.title}</span>
            <span className="text-xs text-muted-foreground">{getCollectionLabel(selectedEntry.type)}</span>
          </div>
          <div className="flex gap-1 flex-none">
            <button
              type="button"
              onClick={toggleDisplay}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={`Switch to ${currentDisplay === 'inline' ? 'block' : 'inline'} display`}
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
              Change
            </Button>
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Remove reference"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : currentId && !selectedEntry ? (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50 flex-none">
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <span className="text-sm text-muted-foreground block mb-0.5">
              {isFetched && !listPending ? 'Referenced entry not found' : 'Loading…'}
            </span>
            <span className="text-xs text-muted-foreground">{currentId}</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
            Select entry
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50 flex-none">
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <span className="text-sm text-muted-foreground block mb-1">No entry selected</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
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
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select entry to embed</DialogTitle>
          </DialogHeader>

          {/* Search + filter bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter entries…"
                className="w-full text-sm pl-8 pr-3 py-2 rounded-md border border-border bg-layout-bg"
              />
            </div>
            <select
              value={collectionFilter ?? ''}
              onChange={(e) => setCollectionFilter(e.target.value || null)}
              className="text-sm rounded-md border border-border bg-layout-bg px-2 py-2"
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
          <div className="flex-1 overflow-y-auto min-h-0 border border-border rounded-md">
            {listPending && entries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Loading entries…</div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {searchQuery ? 'No matching entries' : 'No entries found'}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredEntries.map((entry) => {
                  const refKey = toReferenceKey(entry.path);
                  const isSelected = refKey === toReferenceKey(currentId);
                  return (
                    <button
                      key={`${entry.type}-${entry.id}`}
                      type="button"
                      onClick={() => handleSelect(entry)}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${
                        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                      }`}
                    >
                      <FileText className="w-4 h-4 flex-none text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{entry.title}</div>
                        <div className="text-xs text-muted-foreground">{getCollectionLabel(entry.type)}</div>
                      </div>
                      {isSelected && <span className="text-xs font-medium text-primary flex-none">Selected</span>}
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
