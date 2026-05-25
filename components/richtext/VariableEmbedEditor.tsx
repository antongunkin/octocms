'use client';

import React, { useCallback } from 'react';
import { Icon } from '../ui/icons';
import type { JsxEditorProps } from '@mdxeditor/editor';
import { useMdastNodeUpdater } from '@mdxeditor/editor';

/**
 * WYSIWYG editor component for `<CmsVar>` JSX embeds inside richtext fields.
 *
 * Renders the variable as a colored inline pill in the editor. Shows a dropdown
 * to pick from the allowed variable names defined in the richtext field config.
 */
const VariableEmbedEditor: React.FC<JsxEditorProps & { allowedVariables?: string[] }> = ({
  mdastNode,
  allowedVariables,
}) => {
  const updateNode = useMdastNodeUpdater();

  const nameAttr = mdastNode.attributes?.find((a: any) => a.type === 'mdxJsxAttribute' && a.name === 'name');
  const currentName = typeof nameAttr?.value === 'string' ? nameAttr.value : '';

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newName = e.target.value;
      updateNode({
        attributes: [{ type: 'mdxJsxAttribute', name: 'name', value: newName }],
      } as any);
    },
    [updateNode],
  );

  const variables = allowedVariables ?? [];

  // If the variable is set and in the allowed list (or no allowed list), show the pill + visible select
  if (currentName && (variables.length === 0 || variables.includes(currentName))) {
    return (
      <span className="octo-var-embed octo-var-embed--set" contentEditable={false}>
        <Icon.Variable className="octo-var-embed__icon" aria-hidden />
        {variables.length > 0 ? (
          <select
            value={currentName}
            onChange={handleChange}
            className="octo-var-embed__select"
            aria-label="Change variable"
          >
            {variables.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ) : (
          <span>{currentName}</span>
        )}
      </span>
    );
  }

  // No variable selected yet — show a compact picker
  return (
    <span className="octo-var-embed octo-var-embed--unset" contentEditable={false}>
      <Icon.Variable className="octo-var-embed__icon" />
      {variables.length > 0 ? (
        <select
          value={currentName}
          onChange={handleChange}
          className="octo-var-embed__select"
          aria-label="Select variable"
        >
          <option value="">Pick variable…</option>
          {variables.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      ) : (
        <span className="octo-var-embed__none">No variables configured</span>
      )}
    </span>
  );
};

export default VariableEmbedEditor;
