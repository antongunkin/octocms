'use client';

/**
 * Shared dialog for adding and editing a single field on a content type.
 *
 * - Add mode (`mode === 'add'`): two-step. Step 1 picks the format from a card
 *   grid driven by `FIELD_FORMAT_META`. Step 2 collects label/key/options.
 * - Edit mode (`mode === 'edit'`): jumps straight to the options form,
 *   pre-filled from the existing field.
 *
 * The dialog talks to `previewSchemaChange` / `saveSchema` directly (mirrors
 * the content-type dialogs from Phase 4). On format change in edit mode it
 * surfaces an impact warning before save (Phase 6 reuse).
 *
 * Conditional and richtext have dedicated sub-editors mounted inline once
 * their format is selected — see `ConditionalBranchesEditor` and
 * `RichTextOptionsEditor`.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Star, Star as StarFilled } from 'lucide-react';

import { previewSchemaChange } from '../../admin/actions';
import { useSaveSchema } from '../../admin/query/hooks/useSaveSchema';
import type { PreviewSchemaResult } from '../../admin/actions/schema';
import { FIELD_FORMAT_META, FIELD_FORMATS } from '../../schema/fieldFormats';
import { toast } from '../../hooks/useToast';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import type { CollectionField, Collection, Config, FieldFormat } from '../../types';
import ConditionalBranchesEditor from './ConditionalBranchesEditor';
import RichTextOptionsEditor from './RichTextOptionsEditor';
import SchemaImpactList from './SchemaImpactList';
import SchemaOptionFieldInput from './SchemaOptionFieldInput';
import { describeInvalidFieldKey, slugifyFieldKey } from './fieldKey';
import { draftToField, emptyDraft, fieldToDraft, reorderFields, type FieldDraft } from './fieldOptions';

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: Config;
  /** Collection key the field belongs to (or, in nested mode, the parent
   *  collection key — see `nested`). */
  type: string;
  /** When provided, the dialog returns the new field via `onLocalSubmit`
   *  instead of calling `saveSchema`. Used for nested fields inside conditional
   *  branches so the outer dialog can persist them as part of its own save. */
  nested?: {
    initialKey: string | null;
    initialField: CollectionField | null;
    onLocalSubmit: (key: string, field: CollectionField) => void;
  };
}

type Props = BaseProps & ({ mode: 'add'; existingFieldKey?: never } | { mode: 'edit'; existingFieldKey: string });

const NAME_LIMIT = 60;
const KEY_LIMIT = 64;

export default function FieldDialog(props: Props) {
  const { open, onOpenChange, schema, type, nested } = props;
  const saveSchemaMutation = useSaveSchema();

  const collection: Collection | undefined = schema.collections[type];

  const initialField: CollectionField | null = useMemo(() => {
    if (nested) return nested.initialField;
    if (props.mode === 'edit') return collection?.fields[props.existingFieldKey] ?? null;
    return null;
  }, [collection, nested, props]);

  const initialKey: string | null = nested ? nested.initialKey : props.mode === 'edit' ? props.existingFieldKey : null;

  // Two-step state for Add mode.
  const [step, setStep] = useState<'format' | 'options'>(props.mode === 'add' && !initialField ? 'format' : 'options');

  const [draft, setDraft] = useState<FieldDraft>(() => {
    if (initialField) return fieldToDraft(initialKey ?? '', initialField);
    return emptyDraft('string');
  });
  const [keyTouched, setKeyTouched] = useState(initialKey !== null);
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewSchemaResult | null>(null);

  // Inline nested-field dialog state (for conditional branches).
  const [nestedDialog, setNestedDialog] = useState<null | {
    branchIdx: number;
    nestedKey: string | null;
    initial: CollectionField | null;
    save: (key: string, field: CollectionField) => void;
  }>(null);

  // Reset on open.
  useEffect(() => {
    if (!open) return;
    if (initialField) {
      setDraft(fieldToDraft(initialKey ?? '', initialField));
      setKeyTouched(true);
      setStep('options');
    } else {
      setDraft(emptyDraft('string'));
      setKeyTouched(false);
      setStep(props.mode === 'add' && !nested ? 'format' : 'options');
    }
    setPreview(null);
    setBusy(false);
    setPreviewing(false);
  }, [open, initialField, initialKey, props.mode, nested]);

  // Auto-derive key from label until touched.
  useEffect(() => {
    if (keyTouched) return;
    setDraft((d) => ({ ...d, key: slugifyFieldKey(d.label) }));
  }, [draft.label, keyTouched]);

  const otherKeys = useMemo(() => {
    if (!collection) return new Set<string>();
    const keys = new Set(Object.keys(collection.fields));
    if (initialKey) keys.delete(initialKey);
    return keys;
  }, [collection, initialKey]);

  if (!collection) return null;

  const trimmedLabel = draft.label.trim();
  const trimmedKey = draft.key.trim();
  const labelError = trimmedLabel.length === 0 ? 'Label is required.' : null;
  const keyError = describeInvalidFieldKey(trimmedKey);

  const duplicateKey = otherKeys.has(trimmedKey);

  const meta = FIELD_FORMAT_META[draft.format];

  const formatChanged = initialField !== null && initialField.format !== draft.format;
  const keyChanged = initialKey !== null && initialKey !== trimmedKey;

  const formatLooksValid = (() => {
    if (draft.format === 'select') {
      const opts = (draft.options.options ?? []) as { label: string; value: string }[];
      if (opts.length === 0) return false;
      const values = opts.map((o) => o.value);
      if (values.some((v) => !v)) return false;
      if (new Set(values).size !== values.length) return false;
    }
    if (draft.format === 'conditional') {
      if (draft.branches.length === 0) return false;
      const keys = draft.branches.map((b) => b.key);
      if (keys.some((k) => !k)) return false;
      if (new Set(keys).size !== keys.length) return false;
    }
    return true;
  })();

  const canSubmit = !labelError && !keyError && !duplicateKey && !busy && !previewing && formatLooksValid;

  // ---------------------------------------------------------------------
  // Build & save
  // ---------------------------------------------------------------------

  const buildNextSchema = (): Config => {
    if (nested) return schema;
    const fieldNext = draftToField({ ...draft, label: trimmedLabel, key: trimmedKey });

    // Enforce single-entryTitle invariant: if this draft is entryTitle,
    // clear the flag from any sibling that previously held it.
    const nextFields: Record<string, CollectionField> = {};
    for (const [k, f] of Object.entries(collection.fields)) {
      if (k === initialKey) continue;
      let copy: CollectionField = f;
      if (draft.entryTitle && f.entryTitle === true) {
        const stripped = { ...f } as CollectionField & { entryTitle?: boolean };
        delete stripped.entryTitle;
        copy = stripped;
      }
      nextFields[k] = copy;
    }
    // Insert / replace at the original position when editing, else append.
    if (initialKey && initialKey in collection.fields) {
      const ordered: Record<string, CollectionField> = {};
      for (const k of Object.keys(collection.fields)) {
        if (k === initialKey) ordered[trimmedKey] = fieldNext;
        else if (k in nextFields) ordered[k] = nextFields[k]!;
      }
      return {
        ...schema,
        collections: { ...schema.collections, [type]: { ...collection, fields: ordered } },
      };
    }
    nextFields[trimmedKey] = fieldNext;
    return {
      ...schema,
      collections: { ...schema.collections, [type]: { ...collection, fields: nextFields } },
    };
  };

  const previewIfNeeded = async () => {
    // Nested mode never round-trips through the server.
    if (nested) return doSubmit();
    if (!keyChanged && !formatChanged) return doSubmit();
    setPreviewing(true);
    const opts = keyChanged ? { fieldRenames: { [type]: { [initialKey ?? '']: trimmedKey } } } : {};
    const result = await previewSchemaChange(buildNextSchema(), opts);
    setPreviewing(false);
    setPreview(result);
  };

  const doSubmit = async () => {
    if (nested) {
      const built = draftToField({ ...draft, label: trimmedLabel, key: trimmedKey });
      nested.onLocalSubmit(trimmedKey, built);
      onOpenChange(false);
      return;
    }
    setBusy(true);
    const opts = keyChanged
      ? {
          fieldRenames: { [type]: { [initialKey ?? '']: trimmedKey } },
          message: `CMS: rename field ${type}.${initialKey} → ${trimmedKey}`,
        }
      : {
          message:
            initialField === null ? `CMS: add field ${type}.${trimmedKey}` : `CMS: update field ${type}.${trimmedKey}`,
        };
    try {
      await saveSchemaMutation.mutateAsync({ next: buildNextSchema(), options: opts });
      toast({
        title: initialField === null ? 'Field added' : 'Field updated',
        description: `${trimmedLabel} (${trimmedKey})`,
        variant: 'success',
      });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Couldn't save field",
        description: e instanceof Error ? e.message : 'Save failed',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  const isAdd = props.mode === 'add' && initialField === null;
  const title = isAdd ? 'Add field' : `Edit field — ${initialField?.label ?? ''}`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="octo-dialog-content--3xl octo-dialog-content--vh-88 octo-dialog-content--overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {step === 'format'
                ? 'Pick the field type. Each type stores values differently and exposes a different editor.'
                : nested
                  ? 'Configure this field. Saved when you save the parent field.'
                  : 'Configure the field. Saving triggers a single commit that updates the schema and any affected entries.'}
            </DialogDescription>
          </DialogHeader>

          {step === 'format' ? (
            <FormatPicker
              currentFormat={draft.format}
              onPick={(format) => {
                setDraft((d) => ({ ...emptyDraft(format), label: d.label, key: d.key }));
                setStep('options');
              }}
            />
          ) : (
            <div className="octo-dialog-fields">
              <div className="octo-field-dialog__format-row">
                <div className="octo-field-dialog__format-info">
                  <span className="octo-field-dialog__format-key">format:</span>
                  <span className="octo-field-dialog__format-badge">
                    {meta?.label} ({draft.format})
                  </span>
                </div>
                {isAdd ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep('format')}
                    className="octo-button--icon-xs"
                  >
                    <ArrowLeft className="octo-icon-xs" /> Change type
                  </Button>
                ) : (
                  <ChangeTypeMenu
                    currentFormat={draft.format}
                    onChange={(next) =>
                      setDraft((d) => ({
                        ...emptyDraft(next),
                        label: d.label,
                        key: d.key,
                        hint: d.hint,
                        required: d.required,
                        searchable: d.searchable,
                        entryTitle: d.entryTitle,
                      }))
                    }
                  />
                )}
              </div>

              {/* Common fields */}
              <div className="octo-field-common-grid">
                <div className="octo-dialog-field">
                  <span className="octo-dialog-field__label-xs">Label</span>
                  <Input
                    value={draft.label}
                    maxLength={NAME_LIMIT}
                    onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                    disabled={busy}
                    placeholder="Title"
                  />
                  {labelError ? <p className="octo-dialog-field__error-xs">{labelError}</p> : null}
                </div>
                <div className="octo-dialog-field">
                  <span className="octo-dialog-field__label-xs">Key</span>
                  <Input
                    value={draft.key}
                    maxLength={KEY_LIMIT}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, key: e.target.value }));
                      setKeyTouched(true);
                    }}
                    disabled={busy}
                    className="octo-u-mono"
                    aria-invalid={Boolean(keyError || duplicateKey)}
                  />
                  <p
                    className={cn(
                      'octo-dialog-field__hint-xs',
                      (keyError || duplicateKey) && 'octo-dialog-field__hint--error',
                    )}
                  >
                    {duplicateKey
                      ? `Key "${trimmedKey}" already exists on this content type.`
                      : (keyError ?? 'Used in JSON, generated types, and the API.')}
                  </p>
                </div>
              </div>

              <div className="octo-dialog-field">
                <span className="octo-dialog-field__label-xs">Hint</span>
                <Input
                  value={draft.hint}
                  onChange={(e) => setDraft((d) => ({ ...d, hint: e.target.value }))}
                  disabled={busy}
                  placeholder="Optional helper text shown below the input."
                />
              </div>

              <div className="octo-field-dialog__toggle-grid">
                <ToggleCheckbox
                  label="Required"
                  description="Block save until non-empty"
                  checked={draft.required}
                  onChange={(v) => setDraft((d) => ({ ...d, required: v }))}
                  disabled={busy}
                />
                <ToggleCheckbox
                  label="Searchable"
                  description="Index for /cms search"
                  checked={draft.searchable}
                  onChange={(v) => setDraft((d) => ({ ...d, searchable: v }))}
                  disabled={busy}
                />
                <EntryTitleToggle
                  format={draft.format}
                  list={draft.options.list === true}
                  checked={draft.entryTitle}
                  onChange={(v) => setDraft((d) => ({ ...d, entryTitle: v }))}
                  disabled={busy}
                />
              </div>

              {/* Per-format options */}
              {meta && meta.optionFields.length > 0 ? (
                <div className="octo-field-dialog__options">
                  <h4 className="octo-field-dialog__options-heading">Options</h4>
                  {/* When `select.multiple` is true we hide `defaultOption`, and when false
                      we hide `defaultOptions`. */}
                  {meta.optionFields
                    .filter((opt) => filterOptionField(opt.key, draft))
                    .map((opt) => (
                      <SchemaOptionFieldInput
                        key={opt.key}
                        spec={opt}
                        value={draft.options[opt.key]}
                        onChange={(v) =>
                          setDraft((d) => ({
                            ...d,
                            options: { ...d.options, [opt.key]: v },
                          }))
                        }
                        availableCollections={Object.keys(schema.collections)}
                        selectOptions={(draft.options.options as { label: string; value: string }[] | undefined) ?? []}
                        disabled={busy}
                      />
                    ))}
                </div>
              ) : null}

              {draft.format === 'conditional' ? (
                <div className="octo-field-dialog__options">
                  <h4 className="octo-field-dialog__options-heading">Branches</h4>
                  <ConditionalBranchesEditor
                    branches={draft.branches}
                    onChange={(branches) => setDraft((d) => ({ ...d, branches }))}
                    availableCollections={Object.keys(schema.collections)}
                    onEditNestedField={(branchIdx, nestedKey, initial, save) =>
                      setNestedDialog({ branchIdx, nestedKey, initial, save })
                    }
                    disabled={busy}
                  />
                </div>
              ) : null}

              {draft.format === 'richtext' ? (
                <div className="octo-field-dialog__options">
                  <h4 className="octo-field-dialog__options-heading">Rich text configuration</h4>
                  <RichTextOptionsEditor
                    value={draft.richtext}
                    onChange={(richtext) => setDraft((d) => ({ ...d, richtext }))}
                    availableCollections={Object.keys(schema.collections)}
                    disabled={busy}
                  />
                </div>
              ) : null}

              {/* Preview / impact */}
              {preview && !preview.valid ? (
                <div className="octo-error-box">
                  <p className="octo-error-box__title">The change is invalid:</p>
                  <ul className="octo-error-box__list">
                    {preview.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {preview && preview.valid && preview.impact.length > 0 ? (
                <SchemaImpactList
                  tone="amber"
                  title={`${preview.impact.length} ${preview.impact.length === 1 ? 'entry' : 'entries'} will be touched`}
                  items={preview.impact}
                />
              ) : null}

              {formatChanged ? (
                <div className="octo-inline-warn">
                  <strong>Heads up:</strong> changing format from <code>{initialField?.format}</code> to{' '}
                  <code>{draft.format}</code> may discard existing values that cannot be safely coerced. Click{' '}
                  <em>Preview</em> to see which entries will lose data.
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            {step === 'format' ? null : preview && preview.valid ? (
              <Button onClick={doSubmit} disabled={busy}>
                {busy ? 'Saving…' : 'Confirm and save'}
              </Button>
            ) : (
              <Button onClick={previewIfNeeded} disabled={!canSubmit}>
                {previewing
                  ? 'Previewing…'
                  : busy
                    ? 'Saving…'
                    : nested
                      ? 'Apply'
                      : (keyChanged || formatChanged) && initialField
                        ? 'Preview'
                        : 'Save'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {nestedDialog ? (
        nestedDialog.initial && nestedDialog.nestedKey ? (
          <FieldDialog
            mode="edit"
            existingFieldKey={nestedDialog.nestedKey}
            open
            onOpenChange={(o) => !o && setNestedDialog(null)}
            schema={schema}
            type={type}
            nested={{
              initialKey: nestedDialog.nestedKey,
              initialField: nestedDialog.initial,
              onLocalSubmit: (key, field) => {
                nestedDialog.save(key, field);
                setNestedDialog(null);
              },
            }}
          />
        ) : (
          <FieldDialog
            mode="add"
            open
            onOpenChange={(o) => !o && setNestedDialog(null)}
            schema={schema}
            type={type}
            nested={{
              initialKey: null,
              initialField: null,
              onLocalSubmit: (key, field) => {
                nestedDialog.save(key, field);
                setNestedDialog(null);
              },
            }}
          />
        )
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FormatPicker({
  currentFormat,
  onPick,
}: {
  currentFormat: FieldFormat;
  onPick: (format: FieldFormat) => void;
}) {
  return (
    <div className="octo-format-picker">
      {FIELD_FORMATS.map((fmt) => {
        const meta = FIELD_FORMAT_META[fmt];
        const active = fmt === currentFormat;
        return (
          <button
            key={fmt}
            type="button"
            onClick={() => onPick(fmt)}
            className={cn('octo-format-card', active && 'octo-format-card--active')}
          >
            <span className="octo-format-card__label">{meta.label}</span>
            <code className="octo-format-card__code">{fmt}</code>
            <p className="octo-format-card__desc">{meta.description}</p>
          </button>
        );
      })}
    </div>
  );
}

function ChangeTypeMenu({
  currentFormat,
  onChange,
}: {
  currentFormat: FieldFormat;
  onChange: (next: FieldFormat) => void;
}) {
  const [openPicker, setOpenPicker] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="octo-button--icon-xs"
        onClick={() => setOpenPicker((v) => !v)}
      >
        Change type
      </Button>
      {openPicker ? (
        <div className="octo-change-type-popover">
          <div className="octo-change-type-grid">
            {FIELD_FORMATS.map((fmt) => {
              const meta = FIELD_FORMAT_META[fmt];
              const active = fmt === currentFormat;
              return (
                <button
                  key={fmt}
                  type="button"
                  className={cn('octo-change-type-item', active && 'octo-change-type-item--active')}
                  onClick={() => {
                    if (!active) onChange(fmt);
                    setOpenPicker(false);
                  }}
                >
                  <span className="octo-change-type-item__label">{meta.label}</span>
                  <code className="octo-change-type-item__code">{fmt}</code>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ToggleCheckbox({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn('octo-field-toggle', disabled && 'octo-field-toggle--disabled')}>
      <input
        type="checkbox"
        style={{ marginTop: 2 }}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="octo-field-toggle__text">
        <span className="octo-field-toggle__label">{label}</span>
        {description ? <span className="octo-field-toggle__desc">{description}</span> : null}
      </span>
    </label>
  );
}

function EntryTitleToggle({
  format,
  list,
  checked,
  onChange,
  disabled,
}: {
  format: FieldFormat;
  list: boolean;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  // Entry title makes sense only for stringy non-list fields.
  const allowed = (format === 'string' && !list) || format === 'text' || format === 'slug';
  const Icon = checked ? StarFilled : Star;
  return (
    <label
      aria-label="Entry title"
      className={cn(
        'octo-field-toggle',
        checked && 'octo-field-toggle--star-active',
        (disabled || !allowed) && 'octo-field-toggle--disabled',
      )}
      title={allowed ? '' : 'Entry title must be a non-list string, text, or slug field.'}
    >
      <input
        type="checkbox"
        style={{ marginTop: 2 }}
        checked={checked}
        disabled={disabled || !allowed}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="octo-field-toggle__text">
        <span className="octo-field-toggle__label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon className={cn('octo-icon-sm', checked ? 'octo-field-table__star--filled' : 'octo-u-text-muted')} />
          Entry title
        </span>
        <span className="octo-field-toggle__desc">Use as display title in entry lists.</span>
      </span>
    </label>
  );
}

/** Hide select option fields that don't apply to the current cardinality. */
function filterOptionField(optKey: string, draft: FieldDraft): boolean {
  if (draft.format === 'select') {
    if (optKey === 'defaultOption' && draft.options.multiple === true) return false;
    if (optKey === 'defaultOptions' && draft.options.multiple !== true) return false;
  }
  if (draft.format === 'reference') {
    const cardinality = draft.options.cardinality ?? 'many';
    if (cardinality === 'one' && (optKey === 'min' || optKey === 'max')) return false;
  }
  return true;
}

// Re-export reorderFields so the page can splice fields without a separate import.
export { reorderFields };
