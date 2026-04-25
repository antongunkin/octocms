'use client';

/**
 * Dispatcher: render a single form control for one `SchemaOptionField`
 * declaration from `octocms/schema/fieldFormats.ts`. Keeps the Add/Edit Field
 * dialog declarative — adding a new option to a format only requires updating
 * the registry, not the dialog UI.
 *
 * Special types like `selectOptions`, `collections`, and `stringList` get
 * dedicated multi-row inputs.
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import type { SchemaOptionField } from '../../schema/types';
import type { SelectOption } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../../lib/utils';

interface Props {
  spec: SchemaOptionField;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Available collection keys for `type: 'collections'`. */
  availableCollections?: readonly string[];
  /** Already-defined select options, used by defaultOption / defaultOptions. */
  selectOptions?: readonly SelectOption[];
  disabled?: boolean;
}

export default function SchemaOptionFieldInput({
  spec,
  value,
  onChange,
  availableCollections = [],
  selectOptions = [],
  disabled,
}: Props) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-foreground">
        {spec.label}
        {spec.required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
      {renderControl({ spec, value, onChange, availableCollections, selectOptions, disabled })}
      {spec.description ? <p className="text-xs text-muted-foreground">{spec.description}</p> : null}
    </div>
  );
}

function renderControl({
  spec,
  value,
  onChange,
  availableCollections,
  selectOptions,
  disabled,
}: Required<Pick<Props, 'spec' | 'value' | 'onChange'>> &
  Pick<Props, 'availableCollections' | 'selectOptions' | 'disabled'>) {
  switch (spec.type) {
    case 'string': {
      // For `select.defaultOption`, render a real select instead of a free
      // text input — the value must match an existing option.
      if (spec.key === 'defaultOption' && selectOptions && selectOptions.length > 0) {
        return (
          <Select
            value={typeof value === 'string' ? value : ''}
            onValueChange={(v) => onChange(v === '__none__' ? undefined : v)}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="No default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No default</SelectItem>
              {selectOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label} ({o.value})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      return (
        <Input
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-9"
        />
      );
    }
    case 'number':
      return (
        <Input
          type="number"
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return onChange(undefined);
            const n = Number(raw);
            onChange(Number.isFinite(n) ? n : undefined);
          }}
          disabled={disabled}
          className="h-9"
        />
      );
    case 'boolean':
      return (
        <BooleanToggle value={value === true} onChange={onChange} disabled={disabled} label={spec.label} />
      );
    case 'enum':
      return (
        <Select
          value={typeof value === 'string' ? value : ''}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(spec.enumValues ?? []).map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'collections':
      return (
        <CollectionsCheckboxList
          available={availableCollections ?? []}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case 'selectOptions':
      return (
        <SelectOptionsEditor
          value={Array.isArray(value) ? (value as SelectOption[]) : []}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case 'stringList':
      // For `select.defaultOptions`, restrict to currently-defined option values.
      if (spec.key === 'defaultOptions' && selectOptions && selectOptions.length > 0) {
        return (
          <DefaultOptionsCheckboxList
            options={selectOptions}
            value={Array.isArray(value) ? (value as string[]) : []}
            onChange={onChange}
            disabled={disabled}
          />
        );
      }
      return (
        <StringListEditor value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} disabled={disabled} />
      );
    default:
      return <p className="text-xs text-muted-foreground">Unsupported option type: {spec.type}</p>;
  }
}

// ---------------------------------------------------------------------------
// Sub-controls
// ---------------------------------------------------------------------------

function BooleanToggle({
  value,
  onChange,
  disabled,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      disabled={disabled}
      aria-pressed={value}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition',
        value ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background hover:bg-muted/50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cn(
          'inline-block h-3 w-6 shrink-0 rounded-full bg-muted-foreground/30 transition',
          value && 'bg-primary',
        )}
      >
        <span
          className={cn(
            'block h-3 w-3 rounded-full bg-background shadow transition',
            value ? 'translate-x-3' : 'translate-x-0',
          )}
        />
      </span>
      <span>{value ? 'On' : 'Off'}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

function CollectionsCheckboxList({
  available,
  value,
  onChange,
  disabled,
}: {
  available: readonly string[];
  value: readonly string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  if (available.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        No collections in the schema yet.
      </p>
    );
  }
  const selected = new Set(value);
  return (
    <div className="space-y-1 rounded-md border border-border bg-background p-2 max-h-44 overflow-auto">
      {available.map((c) => (
        <label
          key={c}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/50',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <input
            type="checkbox"
            disabled={disabled}
            checked={selected.has(c)}
            onChange={() => {
              const next = new Set(selected);
              if (next.has(c)) next.delete(c);
              else next.add(c);
              onChange(available.filter((k) => next.has(k)));
            }}
          />
          <code className="font-mono">{c}</code>
        </label>
      ))}
      {value.length === 0 ? (
        <p className="px-1.5 pt-1 text-[11px] italic text-muted-foreground">
          None selected — references can target any collection.
        </p>
      ) : null}
    </div>
  );
}

function DefaultOptionsCheckboxList({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly SelectOption[];
  value: readonly string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(value);
  return (
    <div className="space-y-1 rounded-md border border-border bg-background p-2 max-h-44 overflow-auto">
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/50',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <input
            type="checkbox"
            disabled={disabled}
            checked={selected.has(o.value)}
            onChange={() => {
              const next = new Set(selected);
              if (next.has(o.value)) next.delete(o.value);
              else next.add(o.value);
              onChange(options.map((x) => x.value).filter((k) => next.has(k)));
            }}
          />
          <span>{o.label}</span>
          <code className="font-mono text-muted-foreground">({o.value})</code>
        </label>
      ))}
    </div>
  );
}

function SelectOptionsEditor({
  value,
  onChange,
  disabled,
}: {
  value: SelectOption[];
  onChange: (v: SelectOption[]) => void;
  disabled?: boolean;
}) {
  const update = (idx: number, patch: Partial<SelectOption>) => {
    const next = value.map((o, i) => (i === idx ? { ...o, ...patch } : o));
    onChange(next);
  };
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const add = () => onChange([...value, { label: '', value: '' }]);

  const valueDuplicates = new Set<string>();
  const seen = new Set<string>();
  for (const o of value) {
    if (seen.has(o.value)) valueDuplicates.add(o.value);
    seen.add(o.value);
  }

  return (
    <div className="space-y-1.5">
      <div className="space-y-1">
        {value.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            No options yet — add at least one.
          </p>
        ) : (
          value.map((o, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                placeholder="Label"
                value={o.label}
                onChange={(e) => update(i, { label: e.target.value })}
                disabled={disabled}
                className="h-9 flex-1"
              />
              <Input
                placeholder="value"
                value={o.value}
                onChange={(e) => update(i, { value: e.target.value })}
                disabled={disabled}
                className={cn(
                  'h-9 flex-1 font-mono text-xs',
                  (o.value === '' || valueDuplicates.has(o.value)) && 'border-destructive/50',
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                onClick={() => remove(i)}
                disabled={disabled}
                aria-label="Remove option"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add} disabled={disabled} className="h-7 text-xs">
        <Plus className="mr-1 h-3 w-3" /> Add option
      </Button>
      {valueDuplicates.size > 0 ? (
        <p className="text-xs text-destructive">Option values must be unique.</p>
      ) : null}
    </div>
  );
}

function StringListEditor({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = React.useState('');
  const commit = () => {
    const t = draft.trim();
    if (!t) return;
    if (!value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {value.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-xs"
          >
            <code className="font-mono">{v}</code>
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== v))}
              className="text-muted-foreground hover:text-destructive"
              disabled={disabled}
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="Press Enter to add"
          disabled={disabled}
          className="h-9 flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={commit} disabled={disabled || !draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
