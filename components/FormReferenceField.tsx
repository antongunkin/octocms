'use client';

import { GripVertical, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import type { Config, ReferenceFieldConfig } from '../admin/types';
import { useConfig } from '../hooks/useConfig';
import { useEntryStack } from '../hooks/useEntryStack';

import { getEntryList, newFile } from '../admin/actions';
import { toast } from '../hooks/useToast';
import { toContentPath, toReferenceKey } from '../lib/referenceKeys';
import { cn } from '../lib/utils';
import type { EntryListItem, ReferenceItem } from '../types';
import { FieldHintAndError } from './FieldHintAndError';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui';

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
      className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:bg-muted/50 cursor-grab active:cursor-grabbing"
    >
      <GripVertical className="w-4 h-4 text-muted-foreground flex-none" />
      <button type="button" onClick={() => onEdit?.(item)} className="flex-1 min-w-0 text-left cursor-pointer group">
        <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">{item.title}</div>
        <div className="text-xs text-muted-foreground">{collectionLabel}</div>
      </button>
      <button
        type="button"
        onClick={() => onEdit?.(item)}
        className="flex-none p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
        title="Edit inline"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="flex-none p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
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
      const allEntries: EntryListItem[] = [];
      for (const col of allowedCollections) {
        const list = await getEntryList(col);
        allEntries.push(...list);
      }
      setEntries(allEntries);
      setIsLoading(false);
    };

    load();
  }, [open, allowedCollections]);

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
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add existing content</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Filter entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background"
            />
          </div>
          {allowedCollections.length > 1 && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-md border border-input bg-background"
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

        <div className="flex-1 overflow-y-auto min-h-0 border border-border rounded-md">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No entries found</div>
          ) : (
            <div className="divide-y divide-border">
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
                      'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                      alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted/50',
                      isChecked && !alreadyAdded && 'bg-primary/5',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked || alreadyAdded}
                      disabled={alreadyAdded}
                      onChange={() => toggleCheck(referenceKey)}
                      className="rounded border-input"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{entry.title}</div>
                      <div className="text-xs text-muted-foreground">{collectionLabel}</div>
                    </div>
                    {alreadyAdded && <span className="text-xs text-muted-foreground flex-none">Already added</span>}
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
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open && allowedCollections.length > 0) {
      setSelectedType(allowedCollections[0]);
    }
  }, [open, allowedCollections]);

  const handleCreate = () => {
    startTransition(async () => {
      const result = await newFile(selectedType);

      if (!result.success) {
        toast({ title: result.error, variant: 'destructive' });
        return;
      }

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
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create new entry</DialogTitle>
        </DialogHeader>

        {allowedCollections.length > 1 ? (
          <div>
            <label htmlFor="create-ref-type-select" className="block text-sm font-medium mb-1.5">
              Content type
            </label>
            <select
              id="create-ref-type-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
            >
              {allowedCollections.map((col) => (
                <option key={col} value={col}>
                  {config.collections[col as keyof Config['collections']]?.label || col}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
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
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [isExistingOpen, setIsExistingOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { pushEntry } = useEntryStack();

  // Resolve allowed collections from new or legacy config
  const allowedCollections = useMemo(() => {
    if (reference?.collections && reference.collections.length > 0) {
      return reference.collections as string[];
    }
    if (collection) {
      return [collection] as string[];
    }
    // Default: all non-media collections
    return Object.keys(config.collections).filter((c) => c !== 'homePage');
  }, [reference, collection, config.collections]);

  const cardinality = reference?.cardinality || 'many';
  const maxItems = cardinality === 'one' ? 1 : reference?.max;
  const minItems = cardinality === 'one' ? (required ? 1 : 0) : Math.max(reference?.min ?? 0, required ? 1 : 0);

  // Load initial items with titles from saved paths
  useEffect(() => {
    const load = async () => {
      let parsedPaths: string[] = [];
      try {
        const parsed = JSON.parse(value);
        if (cardinality === 'one') {
          parsedPaths = typeof parsed === 'string' && parsed ? [parsed] : Array.isArray(parsed) ? parsed : [];
        } else {
          parsedPaths = Array.isArray(parsed) ? parsed : [];
        }
      } catch (_e) {
        // For cardinality 'one', value might be a plain path string
        if (cardinality === 'one' && value && value !== '[]') {
          parsedPaths = [value];
        }
      }

      if (parsedPaths.length === 0) {
        setItems([]);
        setIsLoading(false);
        return;
      }

      // Load all entries from allowed collections to resolve titles
      const allEntries: EntryListItem[] = [];
      for (const col of allowedCollections) {
        const list = await getEntryList(col);
        allEntries.push(...list);
      }

      const entryMap = new Map(allEntries.map((e) => [toReferenceKey(e.path), e]));

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

        // Entry not found — keep normalized key so the user can still see/edit the value.
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
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Listen for entry-saved events to update titles in the reference list
  useEffect(() => {
    const handleEntrySaved = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.id) return;
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== detail.id) return item;
          // Try to resolve the updated title from the saved fields
          const type = detail.type || item.type;
          const collectionDef = config.collections[type as keyof Config['collections']];
          if (!collectionDef) return item;
          const titleFieldKey = Object.keys(collectionDef.fields).find((k) => collectionDef.fields[k].entryTitle);
          const newTitle = titleFieldKey && detail.fields?.[titleFieldKey] ? detail.fields[titleFieldKey] : item.title;
          return { ...item, title: newTitle };
        }),
      );
    };

    const handleEntryDeleted = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.id) return;
      setItems((prev) => prev.filter((item) => item.id !== detail.id));
    };

    window.addEventListener('cms:entry-saved', handleEntrySaved);
    window.addEventListener('cms:entry-deleted', handleEntryDeleted);
    return () => {
      window.removeEventListener('cms:entry-saved', handleEntrySaved);
      window.removeEventListener('cms:entry-deleted', handleEntryDeleted);
    };
  }, [config.collections]);

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
    <div className="mb-6">
      <div className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
        {cardinality === 'one' && <span className="text-xs text-muted-foreground ml-2">(single)</span>}
        {maxItems !== undefined && cardinality === 'many' && (
          <span className="text-xs text-muted-foreground ml-2">
            ({items.length}/{maxItems})
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4">Loading references...</div>
      ) : (
        <>
          {/* Selected items list */}
          {items.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-3">
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

          {items.length === 0 && (
            <div className="text-sm text-muted-foreground py-4 border border-dashed border-border rounded-lg text-center">
              No items selected
            </div>
          )}

          {/* Action buttons */}
          {canAdd && (
            <div className="flex gap-2 mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsExistingOpen(true)}>
                <Plus className="w-4 h-4" />
                Add existing
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4" />
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
