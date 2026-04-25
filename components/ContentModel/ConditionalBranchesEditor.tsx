'use client';

/**
 * Sub-editor for `format: 'conditional'` fields. A conditional field carries
 * one of several typed shapes — each branch is either an inline field map or
 * a reference to an existing collection.
 *
 * v1 surface:
 * - Add / remove / rename branches
 * - Choose branch kind: "inline fields" or "reuse collection"
 * - For inline branches, list nested fields (label + format only). Adding /
 *   editing nested-field options uses the existing AddFieldDialog (recursive)
 *   to keep the option-form authoring consistent with top-level fields.
 *
 * Reordering branches and reordering nested fields uses the same native HTML5
 * drag pattern as `FormReferenceField`.
 */

import React, { useState } from 'react';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';

import type { CollectionField, ConditionalBranchConfig } from '../../types';
import { FIELD_FORMAT_META } from '../../schema/fieldFormats';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../../lib/utils';
import { describeInvalidFieldKey, slugifyFieldKey } from './fieldKey';

interface Props {
  branches: ConditionalBranchConfig[];
  onChange: (next: ConditionalBranchConfig[]) => void;
  /** Available collection keys for "reuse collection" branches. */
  availableCollections: readonly string[];
  /** Open the AddFieldDialog for a nested field. The caller wires this up so
   *  recursion stays at the dialog layer. */
  onEditNestedField: (
    branchIdx: number,
    nestedKey: string | null,
    initial: CollectionField | null,
    save: (key: string, field: CollectionField) => void,
  ) => void;
  disabled?: boolean;
}

export default function ConditionalBranchesEditor({
  branches,
  onChange,
  availableCollections,
  onEditNestedField,
  disabled,
}: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const updateBranch = (idx: number, patch: Partial<ConditionalBranchConfig>) => {
    const next = branches.map((b, i): ConditionalBranchConfig => {
      if (i !== idx) return b;
      // The discriminated union is awkward to merge — branch kind transitions
      // happen via dedicated helpers below, not via patch.
      return { ...b, ...patch } as ConditionalBranchConfig;
    });
    onChange(next);
  };

  const setBranchKind = (idx: number, kind: 'inline' | 'collection') => {
    const next = branches.map((b, i): ConditionalBranchConfig => {
      if (i !== idx) return b;
      if (kind === 'inline') {
        return { key: b.key, label: b.label, fields: ('fields' in b && b.fields) || {} };
      }
      return { key: b.key, label: b.label, collection: availableCollections[0] ?? '' };
    });
    onChange(next);
  };

  const addBranch = () => {
    const baseKey = `branch${branches.length + 1}`;
    onChange([
      ...branches,
      { key: baseKey, label: `Branch ${branches.length + 1}`, fields: {} } as ConditionalBranchConfig,
    ]);
  };

  const removeBranch = (idx: number) => onChange(branches.filter((_, i) => i !== idx));

  const reorderBranch = (from: number, to: number) => {
    if (from === to) return;
    const next = [...branches];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const usedKeys = new Set(branches.map((b) => b.key));

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {branches.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            Add at least one branch — each is a typed shape this field can hold.
          </p>
        ) : (
          branches.map((branch, idx) => {
            const isReference = 'collection' in branch && typeof branch.collection === 'string';
            const keyInvalid = describeInvalidFieldKey(branch.key);
            const duplicate = branches.some((b, i) => i !== idx && b.key === branch.key);
            return (
              <div
                key={idx}
                draggable={!disabled}
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={() => setDragIdx(null)}
                onDrop={() => {
                  if (dragIdx !== null) reorderBranch(dragIdx, idx);
                  setDragIdx(null);
                }}
                className="rounded-md border border-border bg-background p-2.5"
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="mt-2 h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" />
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-muted-foreground">Label</label>
                        <Input
                          value={branch.label}
                          onChange={(e) => updateBranch(idx, { label: e.target.value })}
                          disabled={disabled}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-muted-foreground">Key</label>
                        <Input
                          value={branch.key}
                          onChange={(e) => updateBranch(idx, { key: e.target.value })}
                          disabled={disabled}
                          className={cn(
                            'h-8 font-mono text-xs',
                            (keyInvalid || duplicate) && 'border-destructive/50',
                          )}
                        />
                      </div>
                    </div>
                    {keyInvalid || duplicate ? (
                      <p className="text-xs text-destructive">
                        {duplicate ? 'Branch keys must be unique within the field.' : keyInvalid}
                      </p>
                    ) : null}

                    <div className="flex gap-1.5">
                      <BranchKindPill
                        active={!isReference}
                        label="Inline fields"
                        onClick={() => setBranchKind(idx, 'inline')}
                        disabled={disabled}
                      />
                      <BranchKindPill
                        active={isReference}
                        label="Reuse collection"
                        onClick={() => setBranchKind(idx, 'collection')}
                        disabled={disabled || availableCollections.length === 0}
                      />
                    </div>

                    {isReference ? (
                      <div>
                        <Select
                          value={('collection' in branch && branch.collection) || ''}
                          onValueChange={(v) =>
                            onChange(
                              branches.map((b, i) =>
                                i === idx ? ({ key: b.key, label: b.label, collection: v } as ConditionalBranchConfig) : b,
                              ),
                            )
                          }
                          disabled={disabled}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Pick a collection…" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCollections.map((c) => (
                              <SelectItem key={c} value={c}>
                                <code className="font-mono">{c}</code>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <NestedFieldList
                        fields={('fields' in branch && branch.fields) || {}}
                        onChange={(next) => updateBranch(idx, { fields: next } as Partial<ConditionalBranchConfig>)}
                        onEdit={(nestedKey, current) => {
                          onEditNestedField(idx, nestedKey, current, (newKey, newField) => {
                            const current = ('fields' in branch && branch.fields) || {};
                            const nextFields: Record<string, CollectionField> = { ...current };
                            if (nestedKey && nestedKey !== newKey) delete nextFields[nestedKey];
                            nextFields[newKey] = newField;
                            updateBranch(idx, { fields: nextFields } as Partial<ConditionalBranchConfig>);
                          });
                        }}
                        disabled={disabled}
                      />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeBranch(idx)}
                    disabled={disabled}
                    aria-label="Remove branch"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addBranch} disabled={disabled} className="h-8">
        <Plus className="mr-1 h-3.5 w-3.5" /> Add branch
      </Button>

      {branches.some((b) => !b.key) || branches.length > 0 && new Set(branches.map((b) => b.key)).size !== branches.length ? (
        <p className="text-xs text-destructive">All branches must have a unique non-empty key.</p>
      ) : null}
      {usedKeys.size > 0 ? null : null}
    </div>
  );
}

function BranchKindPill({
  active,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'rounded-md border px-2.5 py-1 text-xs transition',
        active ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background hover:bg-muted/50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {label}
    </button>
  );
}

function NestedFieldList({
  fields,
  onChange,
  onEdit,
  disabled,
}: {
  fields: Record<string, CollectionField>;
  onChange: (next: Record<string, CollectionField>) => void;
  onEdit: (nestedKey: string | null, current: CollectionField | null) => void;
  disabled?: boolean;
}) {
  const entries = Object.entries(fields);
  const remove = (key: string) => {
    const next = { ...fields };
    delete next[key];
    onChange(next);
  };
  return (
    <div className="space-y-1.5 rounded-md border border-border bg-muted/20 p-2">
      {entries.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">No fields in this branch yet.</p>
      ) : (
        entries.map(([key, field]) => (
          <div key={key} className="flex items-center gap-1.5 rounded bg-background px-2 py-1.5">
            <span className="flex-1 truncate text-xs">
              <span className="font-medium">{field.label}</span>
              <code className="ml-1.5 text-muted-foreground">{key}</code>
              <span className="ml-2 rounded border border-border bg-muted/40 px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
                {FIELD_FORMAT_META[field.format]?.label ?? field.format}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onEdit(key, field)}
              disabled={disabled}
              aria-label="Edit nested field"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => remove(key)}
              disabled={disabled}
              aria-label="Remove nested field"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => onEdit(null, null)}
        disabled={disabled}
      >
        <Plus className="mr-1 h-3 w-3" /> Add field
      </Button>
    </div>
  );
}

// Lightweight slugifier wrapper kept here in case the dialog wants to derive
// a default branch key from a label. Currently unused but exported for tests.
export function defaultBranchKey(label: string): string {
  return slugifyFieldKey(label) || `branch${Date.now()}`;
}
