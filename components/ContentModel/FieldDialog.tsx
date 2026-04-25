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
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, Star as StarFilled } from 'lucide-react';

import { previewSchemaChange, saveSchema } from '../../admin/actions';
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
  const router = useRouter();

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
    const result = await saveSchema(buildNextSchema(), opts);
    setBusy(false);
    if (result.success) {
      toast({
        title: initialField === null ? 'Field added' : 'Field updated',
        description: `${trimmedLabel} (${trimmedKey})`,
        variant: 'success',
      });
      onOpenChange(false);
      router.refresh();
    } else {
      toast({ title: "Couldn't save field", description: result.error, variant: 'destructive' });
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
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
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
            <div className="space-y-4 py-1">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-[11px] text-muted-foreground">format:</span>
                  <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px]">
                    {meta?.label} ({draft.format})
                  </span>
                </div>
                {isAdd ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep('format')}
                    className="h-7 text-xs"
                  >
                    <ArrowLeft className="mr-1 h-3 w-3" /> Change type
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="mb-1 block text-xs font-medium text-foreground">Label</span>
                  <Input
                    value={draft.label}
                    maxLength={NAME_LIMIT}
                    onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                    disabled={busy}
                    placeholder="Title"
                  />
                  {labelError ? <p className="mt-1 text-[11px] text-destructive">{labelError}</p> : null}
                </div>
                <div>
                  <span className="mb-1 block text-xs font-medium text-foreground">Key</span>
                  <Input
                    value={draft.key}
                    maxLength={KEY_LIMIT}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, key: e.target.value }));
                      setKeyTouched(true);
                    }}
                    disabled={busy}
                    className="font-mono text-sm"
                    aria-invalid={Boolean(keyError || duplicateKey)}
                  />
                  <p
                    className={cn(
                      'mt-1 text-[11px] text-muted-foreground',
                      (keyError || duplicateKey) && 'text-destructive',
                    )}
                  >
                    {duplicateKey
                      ? `Key "${trimmedKey}" already exists on this content type.`
                      : (keyError ?? 'Used in JSON, generated types, and the API.')}
                  </p>
                </div>
              </div>

              <div>
                <span className="mb-1 block text-xs font-medium text-foreground">Hint</span>
                <Input
                  value={draft.hint}
                  onChange={(e) => setDraft((d) => ({ ...d, hint: e.target.value }))}
                  disabled={busy}
                  placeholder="Optional helper text shown below the input."
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
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
                <div className="space-y-3 rounded-md border border-border bg-background p-3">
                  <h4 className="text-xs font-semibold text-foreground">Options</h4>
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
                <div className="space-y-2 rounded-md border border-border bg-background p-3">
                  <h4 className="text-xs font-semibold text-foreground">Branches</h4>
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
                <div className="space-y-2 rounded-md border border-border bg-background p-3">
                  <h4 className="text-xs font-semibold text-foreground">Rich text configuration</h4>
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
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  <p className="font-medium">The change is invalid:</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
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
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
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
    <div className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-3">
      {FIELD_FORMATS.map((fmt) => {
        const meta = FIELD_FORMAT_META[fmt];
        const active = fmt === currentFormat;
        return (
          <button
            key={fmt}
            type="button"
            onClick={() => onPick(fmt)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-md border p-2.5 text-left transition',
              active
                ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                : 'border-border bg-background hover:bg-muted/50',
            )}
          >
            <span className="text-sm font-semibold text-foreground">{meta.label}</span>
            <code className="text-[10px] font-mono text-muted-foreground">{fmt}</code>
            <p className="text-[11px] leading-snug text-muted-foreground line-clamp-3">{meta.description}</p>
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
    <div className="relative">
      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpenPicker((v) => !v)}>
        Change type
      </Button>
      {openPicker ? (
        <div className="absolute right-0 z-50 mt-1 w-72 rounded-md border border-border bg-popover p-1 shadow-lg">
          <div className="grid grid-cols-2 gap-1">
            {FIELD_FORMATS.map((fmt) => {
              const meta = FIELD_FORMAT_META[fmt];
              const active = fmt === currentFormat;
              return (
                <button
                  key={fmt}
                  type="button"
                  className={cn(
                    'flex flex-col items-start rounded px-2 py-1 text-left text-xs hover:bg-muted/50',
                    active && 'bg-primary/10 ring-1 ring-primary/40',
                  )}
                  onClick={() => {
                    if (!active) onChange(fmt);
                    setOpenPicker(false);
                  }}
                >
                  <span className="font-medium">{meta.label}</span>
                  <code className="font-mono text-[10px] text-muted-foreground">{fmt}</code>
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
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background p-2.5 text-xs',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block font-medium text-foreground">{label}</span>
        {description ? <span className="block text-[11px] text-muted-foreground">{description}</span> : null}
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
        'flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-xs transition',
        checked
          ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950'
          : 'border-border bg-background',
        (disabled || !allowed) && 'cursor-not-allowed opacity-50',
      )}
      title={allowed ? '' : 'Entry title must be a non-list string, text, or slug field.'}
    >
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        disabled={disabled || !allowed}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="flex items-center gap-1 font-medium text-foreground">
          <Icon className={cn('h-3.5 w-3.5', checked ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground')} />
          Entry title
        </span>
        <span className="block text-[11px] text-muted-foreground">Use as display title in entry lists.</span>
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
