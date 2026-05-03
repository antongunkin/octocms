'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { GitBranch, Plus, Trash2 } from 'lucide-react';
import type { JsxEditorProps } from '@mdxeditor/editor';
import { useMdastNodeUpdater } from '@mdxeditor/editor';

import { Button } from '../ui/button';

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
    <div className="my-2 rounded-lg border border-border bg-muted/30 p-3" contentEditable={false}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-8 h-8 rounded-lg border border-border bg-teal-900 light:bg-teal-100 flex items-center
              justify-center flex-none"
        >
          <GitBranch className="w-4 h-4 text-teal-300 light:text-teal-700" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-muted-foreground">Condition embed</span>
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
              className="block text-sm font-medium w-full max-w-xs rounded border border-border bg-layout-bg px-1.5
                  py-0.5 focus:outline-none"
              placeholder="Field name (e.g. promo)"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingField(true)}
              className="block text-sm font-medium hover:underline truncate"
              title="Click to edit condition field name"
            >
              {currentField || <span className="text-muted-foreground italic">Set field name…</span>}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-2 flex-wrap">
        {branches.map((branch) => (
          <button
            key={branch.key}
            type="button"
            onClick={() => setActiveTab(branch.key)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === branch.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            {branch.key}
          </button>
        ))}
        <button
          type="button"
          onClick={addBranch}
          className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Add branch"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Active branch editor */}
      {activeBranch && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label htmlFor={`condition-branch-key-${activeBranch.key}`} className="text-xs text-muted-foreground">
              Key:
            </label>
            <input
              id={`condition-branch-key-${activeBranch.key}`}
              type="text"
              value={activeBranch.key}
              onChange={(e) => renameBranch(activeBranch.key, e.target.value)}
              className="text-xs rounded border border-border bg-layout-bg px-1.5 py-0.5 w-32 focus:outline-none"
            />
            {branches.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeBranch(activeBranch.key)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                title="Remove this branch"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
          <textarea
            value={activeBranch.content}
            onChange={(e) => updateBranchContent(activeBranch.key, e.target.value)}
            placeholder="Branch content (markdown)…"
            className="w-full min-h-[80px] text-sm rounded-md border border-border bg-layout-bg px-3 py-2
                resize-y focus:outline-none"
            rows={3}
          />
        </div>
      )}

      {branches.length === 0 && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          No branches yet.{' '}
          <button type="button" onClick={addBranch} className="text-primary hover:underline">
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
