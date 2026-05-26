'use client';

import React, { useCallback } from 'react';
import { Icon } from '../ui';
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
        className="octo-var-embed octo-var-embed--set"
        style={{ background: '#78350f', color: '#fef3c7' }}
        contentEditable={false}
      >
        <Icon.Puzzle className="octo-icon-xs octo-u-shrink-0" />
        <span>{componentDef.label}</span>
        {componentDef.props.map((prop) => {
          const value = getAttrValue(prop.name);
          if (!value) return null;
          return (
            <span key={prop.name} style={{ color: '#fbbf24' }}>
              {prop.name}=&quot;{value}&quot;
            </span>
          );
        })}
      </span>
    );
  }

  // Block: full card with props form
  return (
    <div className="octo-embed-editor" contentEditable={false}>
      <div className="octo-embed-editor__header">
        <div className="octo-embed-editor__icon octo-embed-editor__icon--component">
          <Icon.Puzzle style={{ width: 16, height: 16, color: '#fcd34d' }} />
        </div>
        <div className="octo-embed-editor__title-wrap">
          <span className="octo-embed-editor__subtitle">Component</span>
          <span className="octo-embed-editor__title">{componentDef.label}</span>
        </div>
      </div>

      <div className="octo-embed-editor__body">
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

  switch (prop.type) {
    case 'boolean':
      return (
        <label className="octo-embed-editor__field-checkbox">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={handleCheckbox}
            className="octo-embed-editor__input"
            style={{ width: 'auto' }}
          />
          <span className="octo-embed-editor__field-label">
            {prop.label}
            {prop.required && <span className="octo-embed-editor__field-required">*</span>}
          </span>
        </label>
      );

    case 'number':
      return (
        <label className="octo-embed-editor__field">
          <span className="octo-embed-editor__field-label">
            {prop.label}
            {prop.required && <span className="octo-embed-editor__field-required">*</span>}
          </span>
          <input type="number" value={value} onChange={handleChange} className="octo-embed-editor__input" />
        </label>
      );

    case 'select':
      return (
        <label className="octo-embed-editor__field">
          <span className="octo-embed-editor__field-label">
            {prop.label}
            {prop.required && <span className="octo-embed-editor__field-required">*</span>}
          </span>
          <select value={value} onChange={handleChange} className="octo-embed-editor__input">
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
        <label className="octo-embed-editor__field">
          <span className="octo-embed-editor__field-label">
            {prop.label}
            {prop.required && <span className="octo-embed-editor__field-required">*</span>}
          </span>
          <input
            type="url"
            value={value}
            onChange={handleChange}
            placeholder="https://…"
            className="octo-embed-editor__input"
          />
        </label>
      );

    case 'image':
      return (
        <label className="octo-embed-editor__field">
          <span className="octo-embed-editor__field-label">
            {prop.label}
            {prop.required && <span className="octo-embed-editor__field-required">*</span>}
          </span>
          <input
            type="text"
            value={value}
            onChange={handleChange}
            placeholder="Media UUID"
            className="octo-embed-editor__input"
          />
        </label>
      );

    case 'string':
    default:
      return (
        <label className="octo-embed-editor__field">
          <span className="octo-embed-editor__field-label">
            {prop.label}
            {prop.required && <span className="octo-embed-editor__field-required">*</span>}
          </span>
          <input type="text" value={value} onChange={handleChange} className="octo-embed-editor__input" />
        </label>
      );
  }
}
