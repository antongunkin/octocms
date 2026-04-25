'use client';

/**
 * Sub-editor for `format: 'richtext'` field config — embeds and toolbar.
 *
 * Scope (v1):
 *  - Toggle each toolbar button group on/off (default: all on; explicit `false` only).
 *  - Toggle reference / image / condition embeds; pick allowed reference collections.
 *  - Manage embeddable variables (string list).
 *  - List custom components by name + kind. Detailed prop authoring is done
 *    via the prop list (name + label + type for each prop).
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import type { RichTextComponentDef, RichTextComponentProp, RichTextFieldConfig } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../../lib/utils';

interface Props {
  value: RichTextFieldConfig;
  onChange: (next: RichTextFieldConfig) => void;
  availableCollections: readonly string[];
  disabled?: boolean;
}

const TOOLBAR_KEYS: { key: keyof NonNullable<RichTextFieldConfig['toolbar']>; label: string }[] = [
  { key: 'formatting', label: 'Bold / italic / underline' },
  { key: 'headings', label: 'Headings' },
  { key: 'lists', label: 'Ordered & unordered lists' },
  { key: 'code', label: 'Inline code' },
  { key: 'codeBlock', label: 'Code block' },
  { key: 'links', label: 'Links' },
  { key: 'tables', label: 'Tables' },
  { key: 'thematicBreak', label: 'Horizontal rule' },
  { key: 'images', label: 'Markdown images' },
  { key: 'undoRedo', label: 'Undo / redo' },
];

const PROP_TYPES: RichTextComponentProp['type'][] = ['string', 'number', 'boolean', 'url', 'image', 'select'];

export default function RichTextOptionsEditor({ value, onChange, availableCollections, disabled }: Props) {
  const toolbar = value.toolbar ?? {};
  const embeds = value.embeds ?? {};

  const setToolbar = (k: keyof NonNullable<RichTextFieldConfig['toolbar']>, enabled: boolean) => {
    const next: NonNullable<RichTextFieldConfig['toolbar']> = { ...toolbar };
    if (enabled) delete next[k];
    else next[k] = false;
    onChange({ ...value, toolbar: next });
  };

  const setEmbeds = (patch: Partial<NonNullable<RichTextFieldConfig['embeds']>>) => {
    onChange({ ...value, embeds: { ...embeds, ...patch } });
  };

  return (
    <div className="space-y-4">
      <Section title="Toolbar" description="All buttons are enabled by default. Turn off any you do not want to expose.">
        <div className="grid gap-1 sm:grid-cols-2">
          {TOOLBAR_KEYS.map(({ key, label }) => {
            const on = toolbar[key] !== false;
            return (
              <label
                key={String(key)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/50',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={disabled}
                  onChange={() => setToolbar(key, !on)}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </Section>

      <Section title="Embeds" description="Allow editors to embed live content alongside markdown text.">
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={Boolean(embeds.references)}
              disabled={disabled}
              onChange={(e) =>
                setEmbeds({ references: e.target.checked ? { display: 'both' } : undefined })
              }
            />
            <span>References to other entries</span>
          </label>
          {embeds.references ? (
            <div className="space-y-1.5 rounded-md border border-border bg-muted/20 p-2">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground">Display</label>
                <Select
                  value={embeds.references.display ?? 'both'}
                  onValueChange={(v) =>
                    setEmbeds({
                      references: { ...embeds.references, display: v as 'inline' | 'block' | 'both' },
                    })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inline">Inline</SelectItem>
                    <SelectItem value="block">Block</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Allowed collections (none = any)
                </label>
                <div className="flex flex-wrap gap-1">
                  {availableCollections.length === 0 ? (
                    <span className="text-[11px] italic text-muted-foreground">No collections defined yet.</span>
                  ) : (
                    availableCollections.map((c) => {
                      const selected = embeds.references?.collections?.includes(c) === true;
                      return (
                        <button
                          key={c}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            const cur = new Set(embeds.references?.collections ?? []);
                            if (cur.has(c)) cur.delete(c);
                            else cur.add(c);
                            setEmbeds({
                              references: {
                                ...embeds.references,
                                collections: cur.size > 0 ? Array.from(cur) : undefined,
                              },
                            });
                          }}
                          className={cn(
                            'rounded-md border px-2 py-0.5 text-[11px] font-mono transition',
                            selected
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border bg-background hover:bg-muted/50',
                          )}
                        >
                          {c}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={embeds.images === true}
              disabled={disabled}
              onChange={(e) => setEmbeds({ images: e.target.checked || undefined })}
            />
            <span>Images from media library</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={embeds.conditions === true}
              disabled={disabled}
              onChange={(e) => setEmbeds({ conditions: e.target.checked || undefined })}
            />
            <span>Conditional A/B branches</span>
          </label>
        </div>
      </Section>

      <Section title="Variables" description="Template variables editors can insert (e.g. user.firstName).">
        <VariablesEditor
          value={embeds.variables ?? []}
          onChange={(v) => setEmbeds({ variables: v.length > 0 ? v : undefined })}
          disabled={disabled}
        />
      </Section>

      <Section
        title="Custom components"
        description="Component-driven embeds. Each component is rendered by your app at query time."
      >
        <ComponentsEditor
          value={embeds.components ?? {}}
          onChange={(v) =>
            setEmbeds({ components: Object.keys(v).length > 0 ? v : undefined })
          }
          disabled={disabled}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <h4 className="text-xs font-semibold text-foreground">{title}</h4>
        {description ? <p className="text-[11px] text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function VariablesEditor({
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
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
    setDraft('');
  };
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {value.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px]"
          >
            {v}
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
          placeholder="user.firstName"
          disabled={disabled}
          className="h-8 flex-1 font-mono text-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={commit} disabled={disabled || !draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

function ComponentsEditor({
  value,
  onChange,
  disabled,
}: {
  value: Record<string, RichTextComponentDef>;
  onChange: (v: Record<string, RichTextComponentDef>) => void;
  disabled?: boolean;
}) {
  const entries = Object.entries(value);
  const addComponent = () => {
    const baseName = `Component${entries.length + 1}`;
    onChange({ ...value, [baseName]: { label: baseName, kind: 'block', props: [] } });
  };
  const renameComponent = (oldName: string, newName: string) => {
    if (!newName || oldName === newName) return;
    if (newName in value) return;
    const next: Record<string, RichTextComponentDef> = {};
    for (const [k, v] of Object.entries(value)) {
      next[k === oldName ? newName : k] = v;
    }
    onChange(next);
  };
  const updateComponent = (name: string, patch: Partial<RichTextComponentDef>) => {
    onChange({ ...value, [name]: { ...value[name]!, ...patch } });
  };
  const removeComponent = (name: string) => {
    const next = { ...value };
    delete next[name];
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      {entries.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          No custom components defined.
        </p>
      ) : (
        entries.map(([name, def]) => (
          <div key={name} className="rounded-md border border-border bg-background p-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground">Name (PascalCase)</label>
                <Input
                  value={name}
                  onChange={(e) => renameComponent(name, e.target.value)}
                  disabled={disabled}
                  className="h-8 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground">Display label</label>
                <Input
                  value={def.label}
                  onChange={(e) => updateComponent(name, { label: e.target.value })}
                  disabled={disabled}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground">Kind</label>
              <Select
                value={def.kind}
                onValueChange={(v) => updateComponent(name, { kind: v as 'inline' | 'block' })}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inline">Inline</SelectItem>
                  <SelectItem value="block">Block</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Props</label>
              <PropsEditor
                value={def.props}
                onChange={(props) => updateComponent(name, { props })}
                disabled={disabled}
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => removeComponent(name)}
                disabled={disabled}
              >
                <Trash2 className="mr-1 h-3 w-3" /> Remove component
              </Button>
            </div>
          </div>
        ))
      )}
      <Button type="button" variant="outline" size="sm" onClick={addComponent} disabled={disabled} className="h-8">
        <Plus className="mr-1 h-3.5 w-3.5" /> Add component
      </Button>
    </div>
  );
}

function PropsEditor({
  value,
  onChange,
  disabled,
}: {
  value: readonly RichTextComponentProp[];
  onChange: (v: RichTextComponentProp[]) => void;
  disabled?: boolean;
}) {
  const update = (i: number, patch: Partial<RichTextComponentProp>) =>
    onChange(value.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { name: '', label: '', type: 'string' }]);

  if (value.length === 0) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={add} disabled={disabled} className="h-7 text-xs">
        <Plus className="mr-1 h-3 w-3" /> Add prop
      </Button>
    );
  }
  return (
    <div className="space-y-1">
      {value.map((p, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_120px_auto] gap-1">
          <Input
            placeholder="name"
            value={p.name}
            onChange={(e) => update(i, { name: e.target.value })}
            disabled={disabled}
            className="h-7 font-mono text-xs"
          />
          <Input
            placeholder="Label"
            value={p.label}
            onChange={(e) => update(i, { label: e.target.value })}
            disabled={disabled}
            className="h-7 text-xs"
          />
          <Select
            value={p.type}
            onValueChange={(v) => update(i, { type: v as RichTextComponentProp['type'] })}
            disabled={disabled}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROP_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => remove(i)}
            disabled={disabled}
            aria-label="Remove prop"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} disabled={disabled} className="h-7 text-xs">
        <Plus className="mr-1 h-3 w-3" /> Add prop
      </Button>
    </div>
  );
}
