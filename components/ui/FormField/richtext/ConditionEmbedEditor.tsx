'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Button } from '../../Button/Button';
import { Icon } from '../../Icon/Icon';
import type { JsxEditorProps } from '@mdxeditor/editor';
import { useMdastNodeUpdater } from '@mdxeditor/editor';

/**
 * WYSIWYG editor component for `<CmsCondition>` JSX embeds inside richtext fields.
 *
 * Renders a tabbed card where each tab is a branch (e.g. "control", "test").
 * Each branch's content is stored as the text value of a `<CmsBranch key="...">` child element.
 * The `field` attribute identifies this condition (e.g. "promo", "hero").
 */
const ConditionEmbedEditor: React.FC<JsxEditorProps> = ({ mdastNode }) => {
  const updateNode = useMdastNodeUpdater();

  // Read `field` attribute
  const fieldAttr = mdastNode.attributes?.find((a: any) => a.type === 'mdxJsxAttribute' && a.name === 'field');
  const currentField = typeof fieldAttr?.value === 'string' ? fieldAttr.value : '';

  // Parse CmsBranch children to extract { key, content } pairs
  const branches = useMemo(() => {
    const result: { key: string; content: string }[] = [];
    for (const child of mdastNode.children ?? []) {
      if (child.type === 'mdxJsxFlowElement' && child.name === 'CmsBranch') {
        const keyAttr = (child as any).attributes?.find((a: any) => a.type === 'mdxJsxAttribute' && a.name === 'key');
        const key = typeof keyAttr?.value === 'string' ? keyAttr.value : '';
        // Extract text content from children of CmsBranch
        const content = serializeChildrenToMarkdown((child as any).children ?? []);
        result.push({ key, content });
      }
    }
    return result;
  }, [mdastNode.children]);

  const [activeTab, setActiveTab] = useState(branches[0]?.key ?? '');
  const [editingField, setEditingField] = useState(false);

  const updateField = useCallback(
    (newField: string) => {
      const existingAttrs = (mdastNode.attributes ?? []).filter(
        (a: any) => a.type === 'mdxJsxAttribute' && a.name !== 'field',
      );
      updateNode({
        attributes: [...existingAttrs, { type: 'mdxJsxAttribute', name: 'field', value: newField }],
      } as any);
    },
    [mdastNode.attributes, updateNode],
  );

  const updateBranchContent = useCallback(
    (branchKey: string, newContent: string) => {
      const children = (mdastNode.children ?? []).map((child: any) => {
        if (child.type === 'mdxJsxFlowElement' && child.name === 'CmsBranch') {
          const keyAttr = child.attributes?.find((a: any) => a.type === 'mdxJsxAttribute' && a.name === 'key');
          const key = typeof keyAttr?.value === 'string' ? keyAttr.value : '';
          if (key === branchKey) {
            return {
              ...child,
              children: [{ type: 'text', value: newContent }],
            };
          }
        }
        return child;
      });
      updateNode({ children } as any);
    },
    [mdastNode.children, updateNode],
  );

  const addBranch = useCallback(() => {
    const existingKeys = branches.map((b) => b.key);
    let newKey = 'variant';
    let counter = 1;
    while (existingKeys.includes(newKey)) {
      newKey = `variant${counter}`;
      counter++;
    }
    const newChild = {
      type: 'mdxJsxFlowElement',
      name: 'CmsBranch',
      attributes: [{ type: 'mdxJsxAttribute', name: 'key', value: newKey }],
      children: [{ type: 'text', value: '' }],
    };
    updateNode({
      children: [...(mdastNode.children ?? []), newChild],
    } as any);
    setActiveTab(newKey);
  }, [branches, mdastNode.children, updateNode]);

  const removeBranch = useCallback(
    (branchKey: string) => {
      if (branches.length <= 1) return; // Must keep at least one branch
      const children = (mdastNode.children ?? []).filter((child: any) => {
        if (child.type === 'mdxJsxFlowElement' && child.name === 'CmsBranch') {
          const keyAttr = child.attributes?.find((a: any) => a.type === 'mdxJsxAttribute' && a.name === 'key');
          const key = typeof keyAttr?.value === 'string' ? keyAttr.value : '';
          return key !== branchKey;
        }
        return true;
      });
      updateNode({ children } as any);
      if (activeTab === branchKey) {
        const remaining = branches.filter((b) => b.key !== branchKey);
        setActiveTab(remaining[0]?.key ?? '');
      }
    },
    [branches, mdastNode.children, updateNode, activeTab],
  );

  const renameBranch = useCallback(
    (oldKey: string, newKey: string) => {
      if (!newKey.trim() || oldKey === newKey) return;
      const children = (mdastNode.children ?? []).map((child: any) => {
        if (child.type === 'mdxJsxFlowElement' && child.name === 'CmsBranch') {
          const keyAttr = child.attributes?.find((a: any) => a.type === 'mdxJsxAttribute' && a.name === 'key');
          const key = typeof keyAttr?.value === 'string' ? keyAttr.value : '';
          if (key === oldKey) {
            return {
              ...child,
              attributes: [{ type: 'mdxJsxAttribute', name: 'key', value: newKey }],
            };
          }
        }
        return child;
      });
      updateNode({ children } as any);
      if (activeTab === oldKey) {
        setActiveTab(newKey);
      }
    },
    [mdastNode.children, updateNode, activeTab],
  );

  const activeBranch = branches.find((b) => b.key === activeTab);

  return (
    <div className="octo-embed-editor" contentEditable={false}>
      {/* Header */}
      <div className="octo-embed-editor__header">
        <div className="octo-embed-editor__icon octo-embed-editor__icon--condition">
          <Icon.GitBranch style={{ width: 16, height: 16, color: '#5eead4' }} />
        </div>
        <div className="octo-embed-editor__title-wrap">
          <span className="octo-embed-editor__subtitle">Condition embed</span>
          {editingField ? (
            <input
              type="text"
              defaultValue={currentField}
              onBlur={(e) => {
                updateField(e.target.value);
                setEditingField(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateField((e.target as HTMLInputElement).value);
                  setEditingField(false);
                }
              }}
              className="octo-embed-editor__input"
              style={{ display: 'block', maxWidth: 240 }}
              placeholder="Field name (e.g. promo)"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingField(true)}
              className="octo-embed-editor__title"
              title="Click to edit condition field name"
            >
              {currentField || <span className="octo-u-text-muted octo-u-italic">Set field name…</span>}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="octo-embed-editor__tabs">
        {branches.map((branch) => (
          <button
            key={branch.key}
            type="button"
            onClick={() => setActiveTab(branch.key)}
            className={`octo-embed-editor__tab${activeTab === branch.key ? ' octo-embed-editor__tab octo-embed-editor__tab--active' : ''}`}
          >
            {branch.key}
          </button>
        ))}
        <button type="button" onClick={addBranch} className="octo-embed-editor__tab-add" title="Add branch">
          <Icon.Plus className="octo-icon-sm" />
        </button>
      </div>

      {/* Active branch editor */}
      {activeBranch && (
        <div className="octo-embed-editor__body">
          <div className="octo-embed-editor__branch-key-row">
            <label htmlFor={`condition-branch-key-${activeBranch.key}`} className="octo-embed-editor__field-label">
              Key:
            </label>
            <input
              id={`condition-branch-key-${activeBranch.key}`}
              type="text"
              value={activeBranch.key}
              onChange={(e) => renameBranch(activeBranch.key, e.target.value)}
              className="octo-embed-editor__input"
              style={{ width: 128 }}
            />
            {branches.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeBranch(activeBranch.key)}
                style={{ height: 24, width: 24, padding: 0, color: 'var(--octo-muted)' }}
                title="Remove this branch"
              >
                <Icon.Trash2 className="octo-icon-sm" />
              </Button>
            )}
          </div>
          <textarea
            value={activeBranch.content}
            onChange={(e) => updateBranchContent(activeBranch.key, e.target.value)}
            placeholder="Branch content (markdown)…"
            className="octo-embed-editor__textarea"
            rows={3}
          />
        </div>
      )}

      {branches.length === 0 && (
        <div className="octo-embed-editor__empty">
          No branches yet.{' '}
          <button type="button" onClick={addBranch} className="octo-embed-editor__empty-link">
            Add one
          </button>
        </div>
      )}
    </div>
  );
};

export default ConditionEmbedEditor;

// ---------------------------------------------------------------------------
// Helper: serialize mdast children to a plain markdown-like text string
// ---------------------------------------------------------------------------

function serializeChildrenToMarkdown(children: any[]): string {
  return children
    .map((child: any) => {
      if (child.type === 'text') return child.value ?? '';
      if (child.type === 'paragraph') return serializeChildrenToMarkdown(child.children ?? []);
      return '';
    })
    .join('');
}
