'use client';

import React, { useCallback } from 'react';
import { Puzzle } from 'lucide-react';
import type { JsxEditorProps } from '@mdxeditor/editor';
import { useMdastNodeUpdater } from '@mdxeditor/editor';

import type { RichTextComponentDef, RichTextComponentProp } from '../../admin/types';

/**
 * WYSIWYG editor component for custom JSX components embedded in richtext fields.
 *
 * Renders a card with a dynamic props form generated from the `RichTextComponentDef`
 * configuration. Each prop type maps to an appropriate input control.
 */
const ComponentEmbedEditor: React.FC<
  JsxEditorProps & { componentDef: RichTextComponentDef; componentName: string }
> = ({ mdastNode, componentDef, componentName: _componentName }) => {
  const updateNode = useMdastNodeUpdater();

  const getAttrValue = useCallback(
    (name: string): string => {
      const attr = mdastNode.attributes?.find((a: any) => a.type === 'mdxJsxAttribute' && a.name === name);
      return typeof attr?.value === 'string' ? attr.value : '';
    },
    [mdastNode.attributes],
  );

  const updateProp = useCallback(
    (propName: string, value: string) => {
      const existing = (mdastNode.attributes ?? []).filter(
        (a: any) => a.type === 'mdxJsxAttribute' && a.name !== propName,
      );
      updateNode({
        attributes: [...existing, { type: 'mdxJsxAttribute', name: propName, value }],
      } as any);
    },
    [mdastNode.attributes, updateNode],
  );

  const isBlock = componentDef.kind === 'block';

  if (!isBlock) {
    // Inline: compact pill with a popover-style edit on click
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium px-2
            py-0.5 mx-0.5 align-baseline dark:bg-amber-900 dark:text-amber-200"
        contentEditable={false}
      >
        <Puzzle className="w-3 h-3 shrink-0" />
        <span>{componentDef.label}</span>
        {componentDef.props.map((prop) => {
          const value = getAttrValue(prop.name);
          if (!value) return null;
          return (
            <span key={prop.name} className="text-amber-600 dark:text-amber-400">
              {prop.name}=&quot;{value}&quot;
            </span>
          );
        })}
      </span>
    );
  }

  // Block: full card with props form
  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 p-3" contentEditable={false}>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-8 h-8 rounded-lg border border-border bg-amber-100 dark:bg-amber-900 flex items-center
              justify-center flex-none"
        >
          <Puzzle className="w-4 h-4 text-amber-700 dark:text-amber-300" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-muted-foreground">Component</span>
          <span className="text-sm font-medium block truncate">{componentDef.label}</span>
        </div>
      </div>

      <div className="space-y-2">
        {componentDef.props.map((prop) => (
          <PropInput key={prop.name} prop={prop} value={getAttrValue(prop.name)} onChange={updateProp} />
        ))}
      </div>
    </div>
  );
};

export default ComponentEmbedEditor;

// ---------------------------------------------------------------------------
// Individual prop input renderers
// ---------------------------------------------------------------------------

type PropInputProps = {
  prop: RichTextComponentProp;
  value: string;
  onChange: (name: string, value: string) => void;
};

function PropInput({ prop, value, onChange }: PropInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      onChange(prop.name, e.target.value);
    },
    [prop.name, onChange],
  );

  const handleCheckbox = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(prop.name, e.target.checked ? 'true' : 'false');
    },
    [prop.name, onChange],
  );

  const inputClasses = 'w-full text-sm rounded-md border border-border bg-layout-bg px-2 py-1.5 focus:outline-none';
  const labelClasses = 'text-xs font-medium text-muted-foreground';

  switch (prop.type) {
    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={handleCheckbox}
            className="rounded border-border"
          />
          <span className={labelClasses}>
            {prop.label}
            {prop.required && <span className="text-destructive ml-0.5">*</span>}
          </span>
        </label>
      );

    case 'number':
      return (
        <label className="block">
          <span className={labelClasses}>
            {prop.label}
            {prop.required && <span className="text-destructive ml-0.5">*</span>}
          </span>
          <input type="number" value={value} onChange={handleChange} className={inputClasses} />
        </label>
      );

    case 'select':
      return (
        <label className="block">
          <span className={labelClasses}>
            {prop.label}
            {prop.required && <span className="text-destructive ml-0.5">*</span>}
          </span>
          <select value={value} onChange={handleChange} className={inputClasses}>
            {!prop.required && <option value="">—</option>}
            {(prop.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      );

    case 'url':
      return (
        <label className="block">
          <span className={labelClasses}>
            {prop.label}
            {prop.required && <span className="text-destructive ml-0.5">*</span>}
          </span>
          <input type="url" value={value} onChange={handleChange} placeholder="https://…" className={inputClasses} />
        </label>
      );

    case 'image':
      return (
        <label className="block">
          <span className={labelClasses}>
            {prop.label}
            {prop.required && <span className="text-destructive ml-0.5">*</span>}
          </span>
          <input type="text" value={value} onChange={handleChange} placeholder="Media UUID" className={inputClasses} />
        </label>
      );

    case 'string':
    default:
      return (
        <label className="block">
          <span className={labelClasses}>
            {prop.label}
            {prop.required && <span className="text-destructive ml-0.5">*</span>}
          </span>
          <input type="text" value={value} onChange={handleChange} className={inputClasses} />
        </label>
      );
  }
}
