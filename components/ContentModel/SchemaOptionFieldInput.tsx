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
import { Icon } from '../ui/icons';

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
    <div className="octo-option-field-input">
      <label className="octo-option-field-input__label">
        {spec.label}
        {spec.required ? <span className="octo-option-field-input__required">*</span> : null}
      </label>
      {renderControl({ spec, value, onChange, availableCollections, selectOptions, disabled })}
      {spec.description ? <p className="octo-option-field-input__desc">{spec.description}</p> : null}
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
            <SelectTrigger className="octo-select__trigger octo-select__trigger--sm">
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
          className=""
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
          className=""
        />
      );
    case 'boolean':
      return <BooleanToggle value={value === true} onChange={onChange} disabled={disabled} label={spec.label} />;
    case 'enum':
      return (
        <Select value={typeof value === 'string' ? value : ''} onValueChange={(v) => onChange(v)} disabled={disabled}>
          <SelectTrigger className="octo-select__trigger octo-select__trigger--sm">
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
        <StringListEditor
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          disabled={disabled}
        />
      );
    default:
      return <p className="octo-option-field-input__desc">Unsupported option type: {spec.type}</p>;
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
      className={cn('octo-bool-toggle', value && 'octo-bool-toggle octo-bool-toggle--on')}
    >
      <span className="octo-bool-toggle__track">
        <span className="octo-bool-toggle__thumb" />
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
    return <p className="octo-checkbox-list__empty">No collections in the schema yet.</p>;
  }
  const selected = new Set(value);
  return (
    <div className="octo-checkbox-list">
      {available.map((c) => (
        <label
          key={c}
          className={cn(
            'octo-checkbox-list__item',
            disabled && 'octo-checkbox-list__item octo-checkbox-list__item--disabled',
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
          <code className="octo-u-mono">{c}</code>
        </label>
      ))}
      {value.length === 0 ? (
        <p style={{ padding: '4px 6px', fontSize: 11, fontStyle: 'italic', color: 'var(--muted)' }}>
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
    <div className="octo-checkbox-list">
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            'octo-checkbox-list__item',
            disabled && 'octo-checkbox-list__item octo-checkbox-list__item--disabled',
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
          <code className="octo-u-mono octo-u-text-muted">({o.value})</code>
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
    <div className="octo-select-options">
      <div>
        {value.length === 0 ? (
          <p className="octo-select-options__empty">No options yet — add at least one.</p>
        ) : (
          value.map((o, i) => (
            <div key={i} className="octo-select-option-row">
              <Input
                placeholder="Label"
                value={o.label}
                onChange={(e) => update(i, { label: e.target.value })}
                disabled={disabled}
                className="octo-u-flex-1"
              />
              <Input
                placeholder="value"
                value={o.value}
                onChange={(e) => update(i, { value: e.target.value })}
                disabled={disabled}
                className={cn(
                  'octo-u-flex-1 octo-u-mono octo-select__trigger octo-select__trigger--xs',
                  (o.value === '' || valueDuplicates.has(o.value)) && 'octo-input octo-input--invalid',
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="octo-button octo-button--icon-sm octo-button--danger-ghost"
                onClick={() => remove(i)}
                disabled={disabled}
                aria-label="Remove option"
              >
                <Icon.Trash2 className="octo-icon-sm" />
              </Button>
            </div>
          ))
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={add}
        disabled={disabled}
        className="octo-button octo-button--icon-xs"
      >
        <Icon.Plus className="octo-icon-xs" /> Add option
      </Button>
      {valueDuplicates.size > 0 ? <p className="octo-dialog-field__error-xs">Option values must be unique.</p> : null}
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
    <div className="octo-string-list">
      <div className="octo-string-list__tags">
        {value.map((v) => (
          <span key={v} className="octo-string-list__tag">
            <code className="octo-u-mono">{v}</code>
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== v))}
              className="octo-string-list__tag-remove"
              disabled={disabled}
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="octo-string-list__input-row">
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
          className="octo-u-flex-1"
        />
        <Button type="button" variant="outline" onClick={commit} disabled={disabled || !draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
