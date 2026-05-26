'use client';

import { Icon } from '../Icon/Icon';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { cn } from '../../../lib/utils';
import { normalizeStringListFromStorage } from '../../../lib/stringListField';

import { Field } from './Field';

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
    className="octo-ff-list__item"
  >
    <span className="octo-ff-list__item-grip" aria-hidden>
      <Icon.GripVertical className="octo-icon-md" />
    </span>
    <span className="octo-ff-list__item-value">{row.value}</span>
    <span className="octo-ff-list__item-sep" aria-hidden />
    <button
      type="button"
      onClick={() => onRemove(index)}
      className="octo-ff-list__item-remove"
      aria-label={`Remove ${row.value}`}
    >
      <Icon.X className="octo-icon-md" />
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
    <Field label={label} schema="string[]" required={required} hint={hint} error={error}>
      <input
        id={inputId}
        className={cn('octo-ff-list__add-input', error && 'octo-ff-list__add-input octo-ff-list__add-input--error')}
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
        <div className="octo-ff-list__items">
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
      <input type="hidden" name={name} value={serializedValue} />
    </Field>
  );
};

export default FormStringListField;
