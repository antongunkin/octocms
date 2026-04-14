'use client';

import React, { useCallback } from 'react';
import { Variable } from 'lucide-react';
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

  const selectClassName =
    'max-w-[min(280px,85vw)] rounded-md border border-violet-300 bg-white px-1.5 py-0.5 text-xs font-medium ' +
    'text-violet-900 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400/50 ' +
    'dark:border-violet-600 dark:bg-violet-950 dark:text-violet-100';

  // If the variable is set and in the allowed list (or no allowed list), show the pill + visible select
  if (currentName && (variables.length === 0 || variables.includes(currentName))) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 text-violet-800 text-xs font-medium
          px-2 py-0.5 mx-0.5 align-baseline dark:bg-violet-900 dark:text-violet-200"
        contentEditable={false}
      >
        <Variable className="w-3 h-3 shrink-0" aria-hidden />
        {variables.length > 0 ? (
          <select value={currentName} onChange={handleChange} className={selectClassName} aria-label="Change variable">
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
    <span
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-violet-400 bg-violet-50
        text-violet-600 text-xs font-medium px-2 py-0.5 mx-0.5 align-baseline dark:bg-violet-950
        dark:text-violet-300 dark:border-violet-700"
      contentEditable={false}
    >
      <Variable className="w-3 h-3 shrink-0" />
      {variables.length > 0 ? (
        <select value={currentName} onChange={handleChange} className={selectClassName} aria-label="Select variable">
          <option value="">Pick variable…</option>
          {variables.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-violet-400 italic">No variables configured</span>
      )}
    </span>
  );
};

export default VariableEmbedEditor;
