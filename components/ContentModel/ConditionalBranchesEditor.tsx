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
import { GripVertical, Pencil, Plus, Trash2 } from '../ui/icons';

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
    <div className="octo-u-stack octo-u-gap-2">
      <div className="octo-u-stack octo-u-gap-2">
        {branches.length === 0 ? (
          <p className="octo-checkbox-list__empty">
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
                className="octo-branch-card"
              >
                <div className="octo-branch-card__header">
                  <GripVertical className="octo-branch-card__grip octo-icon-sm" />
                  <div className="octo-branch-card__body">
                    <div className="octo-branch-card__grid">
                      <div className="octo-branch-card__field">
                        <span className="octo-branch-card__field-label">Label</span>
                        <Input
                          value={branch.label}
                          onChange={(e) => updateBranch(idx, { label: e.target.value })}
                          disabled={disabled}
                          className="octo-select__trigger--sm"
                        />
                      </div>
                      <div className="octo-branch-card__field">
                        <span className="octo-branch-card__field-label">Key</span>
                        <Input
                          value={branch.key}
                          onChange={(e) => updateBranch(idx, { key: e.target.value })}
                          disabled={disabled}
                          className={cn(
                            'octo-u-mono octo-select__trigger--xs',
                            (keyInvalid || duplicate) && 'octo-input--invalid',
                          )}
                        />
                      </div>
                    </div>
                    {keyInvalid || duplicate ? (
                      <p className="octo-branch-card__error">
                        {duplicate ? 'Branch keys must be unique within the field.' : keyInvalid}
                      </p>
                    ) : null}

                    <div className="octo-branch-card__kind-row">
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
                                i === idx
                                  ? ({ key: b.key, label: b.label, collection: v } as ConditionalBranchConfig)
                                  : b,
                              ),
                            )
                          }
                          disabled={disabled}
                        >
                          <SelectTrigger className="octo-select__trigger--sm">
                            <SelectValue placeholder="Pick a collection…" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCollections.map((c) => (
                              <SelectItem key={c} value={c}>
                                <code className="octo-u-mono">{c}</code>
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
                    className="octo-button--icon-sm octo-button--danger-ghost"
                    onClick={() => removeBranch(idx)}
                    disabled={disabled}
                    aria-label="Remove branch"
                  >
                    <Trash2 className="octo-icon-sm" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addBranch} disabled={disabled}>
        <Plus className="octo-icon-sm" /> Add branch
      </Button>

      {branches.some((b) => !b.key) ||
      (branches.length > 0 && new Set(branches.map((b) => b.key)).size !== branches.length) ? (
        <p className="octo-dialog-field__error-xs">All branches must have a unique non-empty key.</p>
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
      className={cn('octo-branch-kind-pill', active && 'octo-branch-kind-pill--active')}
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
    <div className="octo-nested-field-list">
      {entries.length === 0 ? (
        <p className="octo-nested-field-list__empty">No fields in this branch yet.</p>
      ) : (
        entries.map(([key, field]) => (
          <div key={key} className="octo-nested-field-row">
            <span className="octo-nested-field-row__info">
              <span className="octo-nested-field-row__name">{field.label}</span>
              <code className="octo-nested-field-row__key">{key}</code>
              <span className="octo-nested-field-row__format">
                {FIELD_FORMAT_META[field.format]?.label ?? field.format}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="octo-button--icon-xs"
              onClick={() => onEdit(key, field)}
              disabled={disabled}
              aria-label="Edit nested field"
            >
              <Pencil className="octo-icon-xs" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="octo-button--icon-xs octo-button--danger-ghost"
              onClick={() => remove(key)}
              disabled={disabled}
              aria-label="Remove nested field"
            >
              <Trash2 className="octo-icon-xs" />
            </Button>
          </div>
        ))
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="octo-button--icon-xs"
        onClick={() => onEdit(null, null)}
        disabled={disabled}
      >
        <Plus className="octo-icon-xs" /> Add field
      </Button>
    </div>
  );
}

// Lightweight slugifier wrapper kept here in case the dialog wants to derive
// a default branch key from a label. Currently unused but exported for tests.
export function defaultBranchKey(label: string): string {
  return slugifyFieldKey(label) || `branch${Date.now()}`;
}
