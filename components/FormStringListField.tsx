'use client';

import { GripVertical, X } from 'lucide-react';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { cn } from '../lib/utils';
import { normalizeStringListFromStorage } from '../lib/stringListField';

import { FieldHintAndError } from './FieldHintAndError';

type Row = { id: string; value: string };

type FormStringListFieldProps = {
  label: string;
  name: string;
  /** Stored value: `string[]`, or legacy single `string`. */
  value: unknown;
  required?: boolean;
  hint?: string;
  error?: string;
  onClearError?: (name: string) => void;
};

function rowsFromStrings(values: string[], nextId: () => string): Row[] {
  return values.map((value) => ({ id: nextId(), value }));
}

const ListRow = ({
  row,
  index,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: {
  row: Row;
  index: number;
  onRemove: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, _index: number) => void;
  onDragEnd: () => void;
  onDrop: (index: number) => void;
}) => (
  <div
    draggable
    onDragStart={() => onDragStart(index)}
    onDragOver={(e) => onDragOver(e, index)}
    onDragEnd={onDragEnd}
    onDrop={() => onDrop(index)}
    className={cn(
      'flex items-center gap-0 rounded-lg border border-border bg-muted/40 text-sm',
      'cursor-grab active:cursor-grabbing',
    )}
  >
    <span className="flex-none pl-2 text-muted-foreground" aria-hidden>
      <GripVertical className="h-4 w-4" />
    </span>
    <span className="min-w-0 flex-1 truncate px-2 py-2">{row.value}</span>
    <span className="h-6 w-px flex-none bg-border" aria-hidden />
    <button
      type="button"
      onClick={() => onRemove(index)}
      className="flex-none rounded-r-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      aria-label={`Remove ${row.value}`}
    >
      <X className="h-4 w-4" />
    </button>
  </div>
);

const FormStringListField = ({ label, name, value, required, hint, error, onClearError }: FormStringListFieldProps) => {
  const inputId = useId();
  const idCounterRef = useRef(0);
  const nextRowId = useCallback(() => {
    idCounterRef.current += 1;
    return `str-list-${idCounterRef.current}`;
  }, []);

  const storageKey = useMemo(() => JSON.stringify(normalizeStringListFromStorage(value)), [value]);
  const [rows, setRows] = useState<Row[]>(() =>
    rowsFromStrings(JSON.parse(storageKey) as string[], () => {
      idCounterRef.current += 1;
      return `str-list-${idCounterRef.current}`;
    }),
  );
  const [draft, setDraft] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    idCounterRef.current = 0;
    setRows(rowsFromStrings(JSON.parse(storageKey) as string[], nextRowId));
    setDraft('');
  }, [storageKey, nextRowId]);

  const serializedValue = useMemo(() => JSON.stringify(rows.map((r) => r.value)), [rows]);

  const commitDraft = useCallback(() => {
    const next = draft.trim();
    if (!next) return;
    setRows((prev) => [...prev, { id: nextRowId(), value: next }]);
    setDraft('');
    onClearError?.(name);
  }, [draft, name, nextRowId, onClearError]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitDraft();
    }
  };

  const handleRemove = useCallback(
    (index: number) => {
      setRows((prev) => prev.filter((_, i) => i !== index));
      onClearError?.(name);
    },
    [name, onClearError],
  );

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  const handleDrop = useCallback(
    (targetIndex: number) => {
      if (dragIndex === null || dragIndex === targetIndex) return;
      setRows((prev) => {
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

  return (
    <div className="mb-6">
      <div className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
        {required ? <span className="text-destructive ml-1">*</span> : null}
      </div>
      <input
        id={inputId}
        className={cn(
          'w-full text-sm bg-background text-foreground px-3 py-2 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors mb-2',
          error && 'border-destructive focus:ring-destructive/30',
        )}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (draft.trim()) commitDraft();
        }}
        placeholder="Type the value and hit enter"
        aria-invalid={error ? true : undefined}
      />
      {rows.length > 0 ? (
        <div className="mb-2 flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <ListRow
              key={row.id}
              row={row}
              index={i}
              onRemove={handleRemove}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
            />
          ))}
        </div>
      ) : null}
      <FieldHintAndError hint={hint} error={error} />
      <input type="hidden" name={name} value={serializedValue} />
    </div>
  );
};

export default FormStringListField;
