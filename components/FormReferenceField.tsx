'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Icon } from './ui';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getEntryList } from '../admin/actions/entries';
import { useNewFile } from '../admin/query/hooks/useNewFile';
import { queryKeys } from '../admin/query/keys';
import type { Config, ReferenceFieldConfig } from '../admin/types';
import { useConfig } from '../hooks/useConfig';
import { useEntryStack } from '../hooks/useEntryStack';

import { toast } from '../hooks/useToast';
import { toContentPath, toReferenceKey } from '../lib/referenceKeys';
import { cn } from '../lib/utils';
import type { EntryListItem, ReferenceItem } from '../types';
import { FieldHintAndError } from './FieldHintAndError';

type FormReferenceFieldProps = {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  hint?: string;
  /** Set when submit-time validation fails (takes precedence over inline min/max hint). */
  error?: string;
  onClearError?: (name: string) => void;
  /** @deprecated Use `reference` config instead */
  collection?: string;
  reference?: ReferenceFieldConfig;
};

// ─── Drag-and-drop sortable list ─────────────────────────────────────────────

const DraggableItem = ({
  item,
  index,
  onRemove,
  onEdit,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: {
  item: ReferenceItem;
  index: number;
  onRemove: (index: number) => void;
  onEdit?: (item: ReferenceItem) => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDrop: (index: number) => void;
}) => {
  const config = useConfig();
  const collectionLabel = config.collections[item.type as keyof Config['collections']]?.label || item.type;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onDrop={() => onDrop(index)}
      className="octo-ff-reference__item"
    >
      <Icon.GripVertical className="octo-ff-reference__item-grip" />
      <button type="button" onClick={() => onEdit?.(item)} className="octo-ff-reference__item-body">
        <div className="octo-ff-reference__item-title">{item.title}</div>
        <div className="octo-ff-reference__item-type">{collectionLabel}</div>
      </button>
      <button type="button" onClick={() => onEdit?.(item)} className="octo-ff-reference__item-edit" title="Edit inline">
        <Icon.Pencil className="octo-icon-sm" />
      </button>
      <button type="button" onClick={() => onRemove(index)} className="octo-ff-reference__item-remove">
        <Icon.Trash2 className="octo-icon-sm" />
      </button>
    </div>
  );
};

// ─── Add existing content modal ──────────────────────────────────────────────

const AddExistingModal = ({
  open,
  onOpenChange,
  allowedCollections,
  selectedKeys,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowedCollections: string[];
  selectedKeys: Set<string>;
  onSelect: (items: ReferenceItem[]) => void;
}) => {
  const config = useConfig();
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<EntryListItem[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setChecked(new Set());
    setSearch('');
    setTypeFilter('all');

    const load = async () => {
      try {
        const allEntries: EntryListItem[] = [];
        for (const col of allowedCollections) {
          const list = await queryClient.ensureQueryData({
            queryKey: queryKeys.entries.list(col),
            queryFn: () => getEntryList(col),
          });
          allEntries.push(...list);
        }
        setEntries(allEntries);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [open, allowedCollections, queryClient]);

  // Focus search input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open]);

  const filtered = useMemo(() => {
    let result = entries;
    if (typeFilter !== 'all') {
      result = result.filter((e) => e.type === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) => e.title.toLowerCase().includes(q) || e.type.toLowerCase().includes(q));
    }
    return result;
  }, [entries, typeFilter, search]);

  const toggleCheck = (referenceKey: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(referenceKey)) {
        next.delete(referenceKey);
      } else {
        next.add(referenceKey);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selected = entries
      .filter((e) => checked.has(toReferenceKey(e.path)))
      .map((e) => ({ type: e.type, id: e.id, path: toReferenceKey(e.path), title: e.title }));
    onSelect(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="octo-dialog-content octo-dialog-content--2xl octo-dialog-content--vh-80 octo-dialog-content--flex-col">
        <DialogHeader>
          <DialogTitle>Add existing content</DialogTitle>
        </DialogHeader>

        <div className="octo-ff-reference__filter-row">
          <div className="octo-ff-reference__modal-search">
            <Icon.Search className="octo-ff-reference__modal-search-icon" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Filter entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="octo-ff-reference__modal-input"
            />
          </div>
          {allowedCollections.length > 1 && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="octo-ff-reference__modal-type-select"
            >
              <option value="all">All types</option>
              {allowedCollections.map((col) => (
                <option key={col} value={col}>
                  {config.collections[col as keyof Config['collections']]?.label || col}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="octo-ff-reference__modal-list">
          {isLoading ? (
            <div className="octo-ff-reference__modal-loading">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="octo-ff-reference__modal-empty">No entries found</div>
          ) : (
            <div className="octo-ff-reference__modal-rows">
              {filtered.map((entry) => {
                const referenceKey = toReferenceKey(entry.path);
                const alreadyAdded = selectedKeys.has(referenceKey);
                const isChecked = checked.has(referenceKey);
                const collectionLabel =
                  config.collections[entry.type as keyof Config['collections']]?.label || entry.type;

                return (
                  <label
                    key={entry.path}
                    className={cn(
                      'octo-ff-reference__modal-row',
                      alreadyAdded && 'octo-ff-reference__modal-row octo-ff-reference__modal-row--disabled',
                      isChecked &&
                        !alreadyAdded &&
                        'octo-ff-reference__modal-row octo-ff-reference__modal-row--checked',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked || alreadyAdded}
                      disabled={alreadyAdded}
                      onChange={() => toggleCheck(referenceKey)}
                    />
                    <div className="octo-ff-reference__modal-row-body">
                      <div className="octo-ff-reference__modal-row-title">{entry.title}</div>
                      <div className="octo-ff-reference__modal-row-type">{collectionLabel}</div>
                    </div>
                    {alreadyAdded && <span className="octo-ff-reference__modal-row-added">Already added</span>}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={checked.size === 0}>
            Add {checked.size > 0 ? `(${checked.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Create new entry modal ──────────────────────────────────────────────────

const CreateNewModal = ({
  open,
  onOpenChange,
  allowedCollections,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowedCollections: string[];
  onCreate: (item: ReferenceItem) => void;
}) => {
  const config = useConfig();
  const [selectedType, setSelectedType] = useState(allowedCollections[0] || '');
  const { mutateAsync: createEntry, isPending } = useNewFile();

  useEffect(() => {
    if (open && allowedCollections.length > 0) {
      setSelectedType(allowedCollections[0]);
    }
  }, [open, allowedCollections]);

  const handleCreate = () => {
    void createEntry(selectedType)
      .then((result) => {
        const filePath = result.path;
        const id = filePath.replace(`${config.contentFolder}/${selectedType}/`, '').replace('.json', '');
        const referenceKey = toReferenceKey(filePath);

        const item: ReferenceItem = {
          type: selectedType,
          id,
          path: referenceKey,
          title: `New ${config.collections[selectedType as keyof Config['collections']]?.label || selectedType}`,
        };

        onCreate(item);
        onOpenChange(false);
        toast({
          title: `Created new ${config.collections[selectedType as keyof Config['collections']]?.label || selectedType}`,
          variant: 'success',
        });
      })
      .catch((e: Error) => {
        toast({ title: e.message, variant: 'destructive' });
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="octo-dialog-content octo-dialog-content--md">
        <DialogHeader>
          <DialogTitle>Create new entry</DialogTitle>
        </DialogHeader>

        {allowedCollections.length > 1 ? (
          <div>
            <label htmlFor="create-ref-type-select" className="octo-ff-reference__create-label">
              Content type
            </label>
            <select
              id="create-ref-type-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="octo-ff-reference__create-select"
            >
              {allowedCollections.map((col) => (
                <option key={col} value={col}>
                  {config.collections[col as keyof Config['collections']]?.label || col}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="octo-ff-reference__create-desc">
            Create a new{' '}
            <strong>{config.collections[selectedType as keyof Config['collections']]?.label || selectedType}</strong>{' '}
            entry and add it to this field.
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={isPending}>
            {isPending ? 'Creating...' : 'Create & add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────

const FormReferenceField = ({
  label,
  name,
  value = '[]',
  required,
  hint,
  error: submitError,
  onClearError,
  collection,
  reference,
}: FormReferenceFieldProps) => {
  const config = useConfig();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [isExistingOpen, setIsExistingOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { pushEntry, refreshTick } = useEntryStack();
  // True after the first parse-from-`value` pass; subsequent runs (driven by refreshTick)
  // patch titles on the live items list and drop deleted entries instead of re-parsing `value`.
  const loadedRef = useRef(false);

  // Resolve allowed collections from new or legacy config
  const allowedCollections = useMemo(() => {
    if (reference?.collections && reference.collections.length > 0) {
      return reference.collections as string[];
    }
    if (collection) {
      return [collection] as string[];
    }
    // Default: every `hasMany` collection. Singletons are 1-of-1 fixed-ID
    // entries — referencing them would never produce a meaningful list.
    return Object.entries(config.collections)
      .filter(([, col]) => col?.hasMany)
      .map(([name]) => name);
  }, [reference, collection, config.collections]);

  const cardinality = reference?.cardinality || 'many';
  const maxItems = cardinality === 'one' ? 1 : reference?.max;
  const minItems = cardinality === 'one' ? (required ? 1 : 0) : Math.max(reference?.min ?? 0, required ? 1 : 0);

  // Initial load (parse `value`) and subsequent refresh ticks (patch titles, drop deleted).
  useEffect(() => {
    let cancelled = false;

    const fetchEntryMap = async () => {
      const allEntries: EntryListItem[] = [];
      for (const col of allowedCollections) {
        const list = await queryClient.ensureQueryData({
          queryKey: queryKeys.entries.list(col),
          queryFn: () => getEntryList(col),
        });
        allEntries.push(...list);
      }
      return new Map(allEntries.map((e) => [toReferenceKey(e.path), e]));
    };

    const initialLoad = async () => {
      let parsedPaths: string[] = [];
      try {
        const parsed = JSON.parse(value);
        if (cardinality === 'one') {
          parsedPaths = typeof parsed === 'string' && parsed ? [parsed] : Array.isArray(parsed) ? parsed : [];
        } else {
          parsedPaths = Array.isArray(parsed) ? parsed : [];
        }
      } catch (_e) {
        if (cardinality === 'one' && value && value !== '[]') {
          parsedPaths = [value];
        }
      }

      if (parsedPaths.length === 0) {
        if (cancelled) return;
        setItems([]);
        setIsLoading(false);
        loadedRef.current = true;
        return;
      }

      const entryMap = await fetchEntryMap();
      if (cancelled) return;

      const resolved: ReferenceItem[] = parsedPaths.map((p) => {
        const rawValue = String(p ?? '');
        const normalizedKey = rawValue.includes('/') ? '' : rawValue.endsWith('.json') ? rawValue : `${rawValue}.json`;
        if (!normalizedKey || !toContentPath(normalizedKey)) {
          return { type: '', id: rawValue, path: rawValue, title: rawValue };
        }

        const entry = entryMap.get(normalizedKey);
        if (entry) {
          return { type: entry.type, id: entry.id, path: normalizedKey, title: entry.title };
        }

        const fallbackContentPath = toContentPath(normalizedKey);
        const parts = fallbackContentPath
          ? fallbackContentPath.replace('cms/content/', '').replace('.json', '').split('/')
          : [];
        const fallbackId = parts.length > 0 ? parts[parts.length - 1] : normalizedKey.replace('.json', '');
        const fallbackType = parts.length > 0 ? parts[0] : '';
        return { type: fallbackType, id: fallbackId, path: normalizedKey, title: fallbackId };
      });

      setItems(resolved);
      setIsLoading(false);
      loadedRef.current = true;
    };

    const refreshTitles = async () => {
      const entryMap = await fetchEntryMap();
      if (cancelled) return;
      setItems((prev) =>
        prev
          .map((item): ReferenceItem | null => {
            const entry = entryMap.get(item.path);
            if (entry) return { ...item, title: entry.title, type: entry.type, id: entry.id };
            // Item references a path that's no longer in the allowed collections — treat as deleted.
            return null;
          })
          .filter((x): x is ReferenceItem => x !== null),
      );
    };

    if (loadedRef.current) {
      refreshTitles();
    } else {
      initialLoad();
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick-driven title sync; first parse uses latest `value` once via `loadedRef`
  }, [refreshTick, queryClient, allowedCollections]);

  const selectedKeys = useMemo(() => new Set(items.map((i) => i.path)), [items]);

  // Serialize value for form submission
  const serializedValue = useMemo(() => {
    const paths = items.map((i) => i.path);
    if (cardinality === 'one') {
      return paths[0] || '';
    }
    return JSON.stringify(paths);
  }, [items, cardinality]);

  const handleRemove = useCallback(
    (index: number) => {
      setItems((prev) => prev.filter((_, i) => i !== index));
      onClearError?.(name);
    },
    [name, onClearError],
  );

  const handleAddExisting = useCallback(
    (newItems: ReferenceItem[]) => {
      setItems((prev) => {
        const combined = [...prev, ...newItems];
        return combined;
      });
      onClearError?.(name);
    },
    [name, onClearError],
  );

  const handleCreate = useCallback(
    (item: ReferenceItem) => {
      setItems((prev) => [...prev, item]);
      onClearError?.(name);
    },
    [name, onClearError],
  );

  // Open inline editor for a referenced entry
  const handleEdit = useCallback(
    (item: ReferenceItem) => {
      const contentPath = toContentPath(item.path);
      if (!contentPath) return;
      pushEntry({ id: item.id, type: item.type, path: contentPath, title: item.title });
    },
    [pushEntry],
  );

  // Drag and drop handlers
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, _index: number) => {
    e.preventDefault();
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  const handleDrop = useCallback(
    (targetIndex: number) => {
      if (dragIndex === null || dragIndex === targetIndex) return;

      setItems((prev) => {
        const next = [...prev];
        const [dragged] = next.splice(dragIndex, 1);
        next.splice(targetIndex, 0, dragged);
        return next;
      });
      setDragIndex(null);
      onClearError?.(name);
    },
    [dragIndex, name, onClearError],
  );

  const canAdd = maxItems === undefined || items.length < maxItems;
  const validationError =
    minItems !== undefined && minItems > 0 && items.length < minItems
      ? `At least ${minItems} ${minItems === 1 ? 'item' : 'items'} required`
      : null;
  const displayError = submitError ?? validationError;

  return (
    <div className="octo-ff-reference">
      <div className="octo-ff-reference__label">
        {label}
        {required && <span className="octo-ff-reference__required">*</span>}
        {cardinality === 'one' && <span className="octo-ff-reference__badge">(single)</span>}
        {maxItems !== undefined && cardinality === 'many' && (
          <span className="octo-ff-reference__badge">
            ({items.length}/{maxItems})
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="octo-ff-reference__loading">Loading references...</div>
      ) : (
        <>
          {/* Selected items list */}
          {items.length > 0 && (
            <div className="octo-ff-reference__items">
              {items.map((item, i) => (
                <DraggableItem
                  key={`${item.path}-${i}`}
                  item={item}
                  index={i}
                  onRemove={handleRemove}
                  onEdit={handleEdit}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                />
              ))}
            </div>
          )}

          {items.length === 0 && <div className="octo-ff-reference__empty">No items selected</div>}

          {/* Action buttons */}
          {canAdd && (
            <div className="octo-ff-reference__add-row">
              <Button type="button" variant="outline" onClick={() => setIsExistingOpen(true)}>
                <Icon.Plus className="octo-icon-md" />
                Add existing
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(true)}>
                <Icon.Plus className="octo-icon-md" />
                Create new
              </Button>
            </div>
          )}
        </>
      )}

      <FieldHintAndError hint={hint} error={displayError ?? undefined} />

      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={serializedValue} />

      {/* Modals */}
      <AddExistingModal
        open={isExistingOpen}
        onOpenChange={setIsExistingOpen}
        allowedCollections={allowedCollections}
        selectedKeys={selectedKeys}
        onSelect={handleAddExisting}
      />
      <CreateNewModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        allowedCollections={allowedCollections}
        onCreate={handleCreate}
      />
    </div>
  );
};

export default FormReferenceField;
