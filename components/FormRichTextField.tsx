'use client';

import React, { useCallback, useRef, useEffect, useMemo, useState } from 'react';

import {
  MDXEditorMethods,
  MDXEditor,
  Separator,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  jsxPlugin,
  insertJsx$,
  BoldItalicUnderlineToggles,
  CreateLink,
  ListsToggle,
  BlockTypeSelect,
  InsertTable,
  InsertThematicBreak,
  InsertImage,
  CodeToggle,
  UndoRedo,
  InsertCodeBlock,
} from '@mdxeditor/editor';
import type { JsxComponentDescriptor } from '@mdxeditor/editor';
import { usePublisher } from '@mdxeditor/gurx';
import { FileText, GitBranch, ImagePlus, Puzzle, Variable } from 'lucide-react';

import { cn } from '../lib/utils';
import type { RichTextComponentDef, RichTextFieldConfig } from '../admin/types';

import { FieldHintAndError } from './FieldHintAndError';
import ComponentEmbedEditor from './richtext/ComponentEmbedEditor';
import ConditionEmbedEditor from './richtext/ConditionEmbedEditor';
import ImageEmbedEditor from './richtext/ImageEmbedEditor';
import ReferenceEmbedEditor from './richtext/ReferenceEmbedEditor';
import { SlashMenuOverlay } from './richtext/SlashCommandMenu';
import VariableEmbedEditor from './richtext/VariableEmbedEditor';

type FormRichTextFieldProps = {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  hint?: string;
  error?: string;
  onClearError?: (name: string) => void;
  richtext?: RichTextFieldConfig;
};

function InsertCmsImageButton() {
  const insertJsx = usePublisher(insertJsx$);
  return (
    <button
      type="button"
      title="Insert CMS image"
      className="mdxeditor-toolbar-button"
      onClick={() => {
        insertJsx({
          kind: 'flow',
          name: 'CmsImage',
          props: { mediaId: '' },
        });
      }}
    >
      <ImagePlus className="octo-icon-md" />
    </button>
  );
}

function InsertCmsRefButton() {
  const insertJsx = usePublisher(insertJsx$);
  return (
    <button
      type="button"
      title="Insert entry reference"
      className="mdxeditor-toolbar-button"
      onClick={() => {
        insertJsx({
          kind: 'flow',
          name: 'CmsRef',
          props: { id: '', display: 'block' },
        });
      }}
    >
      <FileText className="octo-icon-md" />
    </button>
  );
}

function InsertCmsVarButton({ variables }: { variables: string[] }) {
  const insertJsx = usePublisher(insertJsx$);
  return (
    <button
      type="button"
      title="Insert template variable"
      className="mdxeditor-toolbar-button"
      onClick={() => {
        insertJsx({
          kind: 'text',
          name: 'CmsVar',
          props: { name: variables[0] ?? '' },
        });
      }}
    >
      <Variable className="octo-icon-md" />
    </button>
  );
}

function InsertCmsConditionButton() {
  const insertJsx = usePublisher(insertJsx$);
  return (
    <button
      type="button"
      title="Insert condition block"
      className="mdxeditor-toolbar-button"
      onClick={() => {
        insertJsx({
          kind: 'flow',
          name: 'CmsCondition',
          props: { field: '' },
        });
      }}
    >
      <GitBranch className="octo-icon-md" />
    </button>
  );
}

const CMS_IMAGE_DESCRIPTOR: JsxComponentDescriptor = {
  name: 'CmsImage',
  kind: 'flow',
  props: [{ name: 'mediaId', type: 'string', required: true }],
  hasChildren: false,
  Editor: ImageEmbedEditor,
};

const CMS_REFERENCE_DESCRIPTOR: JsxComponentDescriptor = {
  name: 'CmsRef',
  kind: 'flow',
  props: [
    { name: 'id', type: 'string', required: true },
    { name: 'display', type: 'string', required: false },
  ],
  hasChildren: false,
  Editor: ReferenceEmbedEditor,
};

function buildCmsVarDescriptor(allowedVariables: string[]): JsxComponentDescriptor {
  return {
    name: 'CmsVar',
    kind: 'text',
    props: [{ name: 'name', type: 'string', required: true }],
    hasChildren: false,
    Editor: (props: any) => <VariableEmbedEditor {...props} allowedVariables={allowedVariables} />,
  };
}

function buildCustomComponentDescriptor(name: string, def: RichTextComponentDef): JsxComponentDescriptor {
  return {
    name,
    kind: def.kind === 'inline' ? 'text' : 'flow',
    props: def.props.map((p) => ({ name: p.name, type: 'string', required: p.required })),
    hasChildren: false,
    Editor: (props: any) => <ComponentEmbedEditor {...props} componentDef={def} componentName={name} />,
  };
}

const CMS_CONDITION_DESCRIPTOR: JsxComponentDescriptor = {
  name: 'CmsCondition',
  kind: 'flow',
  props: [{ name: 'field', type: 'string', required: true }],
  hasChildren: true,
  Editor: ConditionEmbedEditor,
};

const CMS_BRANCH_DESCRIPTOR: JsxComponentDescriptor = {
  name: 'CmsBranch',
  kind: 'flow',
  props: [{ name: 'key', type: 'string', required: true }],
  hasChildren: true,
  Editor: () => null, // Rendered by the parent CmsCondition editor
};

type InsertJsxPayload =
  | { kind: 'text'; name: string; props: Record<string, string> }
  | { kind: 'flow'; name: string; props: Record<string, string> };

/** Syncs insertJsx publisher into a ref — must render under MDXEditor (e.g. toolbar) where RealmContext exists. */
function InsertJsxPublisherBridge({
  targetRef,
}: {
  targetRef: React.MutableRefObject<((payload: InsertJsxPayload) => void) | null>;
}) {
  const publish = usePublisher(insertJsx$);
  useEffect(() => {
    targetRef.current = publish as (payload: InsertJsxPayload) => void;
    return () => {
      targetRef.current = null;
    };
  }, [publish, targetRef]);
  return null;
}

function InsertCustomComponentButton({ components }: { components: Record<string, RichTextComponentDef> }) {
  const insertJsx = usePublisher(insertJsx$);
  const entries = Object.entries(components);
  if (entries.length === 0) return null;

  if (entries.length === 1) {
    const [name, def] = entries[0];
    const defaultProps: Record<string, string> = {};
    for (const p of def.props) {
      defaultProps[p.name] = p.defaultValue != null ? String(p.defaultValue) : '';
    }
    return (
      <button
        type="button"
        title={`Insert ${def.label}`}
        className="mdxeditor-toolbar-button"
        onClick={() => {
          insertJsx({
            kind: def.kind === 'inline' ? 'text' : 'flow',
            name,
            props: defaultProps,
          });
        }}
      >
        <Puzzle className="octo-icon-md" />
      </button>
    );
  }

  // Multiple components — show a dropdown
  return (
    <div className="octo-richtext-toolbar-select-wrap">
      <select
        className="mdxeditor-toolbar-button octo-richtext-toolbar-select"
        value=""
        title="Insert component"
        onChange={(e) => {
          const name = e.target.value;
          if (!name) return;
          const def = components[name];
          if (!def) return;
          const defaultProps: Record<string, string> = {};
          for (const p of def.props) {
            defaultProps[p.name] = p.defaultValue != null ? String(p.defaultValue) : '';
          }
          insertJsx({
            kind: def.kind === 'inline' ? 'text' : 'flow',
            name,
            props: defaultProps,
          });
          e.target.value = '';
        }}
      >
        <option value="">🧩 Insert…</option>
        {entries.map(([name, def]) => (
          <option key={name} value={name}>
            {def.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const FormRichTextField = ({
  label,
  name,
  value,
  required,
  hint,
  error,
  onClearError,
  richtext,
}: FormRichTextFieldProps) => {
  const editorRef = useRef<MDXEditorMethods>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const editorWrapRef = useRef<HTMLDivElement>(null);
  const insertJsxRef = useRef<((payload: InsertJsxPayload) => void) | null>(null);

  // Slash command menu state
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashPosition, setSlashPosition] = useState<{ top: number; left: number } | null>(null);

  const onChange = () => {
    const input = hiddenInputRef.current;
    if (input) {
      input.value = editorRef.current?.getMarkdown() || '';
    }
    onClearError?.(name);
  };

  useEffect(() => {
    editorRef.current?.setMarkdown(value);
  }, [value]);

  // Build slash command items
  const slashItems = useMemo(() => {
    type SlashItem = {
      key: string;
      label: string;
      description?: string;
      icon: React.ReactNode;
      action: () => void;
      keywords?: string[];
    };

    const items: SlashItem[] = [];

    items.push({
      key: 'h1',
      label: 'Heading 1',
      description: 'Large section heading',
      icon: <span className="text-xs font-bold">H1</span>,
      action: () => editorRef.current?.insertMarkdown('\n# '),
      keywords: ['heading', 'title'],
    });
    items.push({
      key: 'h2',
      label: 'Heading 2',
      description: 'Medium section heading',
      icon: <span className="text-xs font-bold">H2</span>,
      action: () => editorRef.current?.insertMarkdown('\n## '),
      keywords: ['heading', 'title'],
    });
    items.push({
      key: 'h3',
      label: 'Heading 3',
      description: 'Small section heading',
      icon: <span className="text-xs font-bold">H3</span>,
      action: () => editorRef.current?.insertMarkdown('\n### '),
      keywords: ['heading', 'title'],
    });
    items.push({
      key: 'bullet-list',
      label: 'Bullet List',
      icon: <span className="text-xs">•</span>,
      action: () => editorRef.current?.insertMarkdown('\n- '),
      keywords: ['list', 'bullet', 'unordered'],
    });
    items.push({
      key: 'numbered-list',
      label: 'Numbered List',
      icon: <span className="text-xs">1.</span>,
      action: () => editorRef.current?.insertMarkdown('\n1. '),
      keywords: ['list', 'numbered', 'ordered'],
    });
    items.push({
      key: 'quote',
      label: 'Quote',
      icon: <span className="text-xs">&gt;</span>,
      action: () => editorRef.current?.insertMarkdown('\n> '),
      keywords: ['quote', 'blockquote'],
    });
    items.push({
      key: 'code-block',
      label: 'Code Block',
      icon: <span className="text-xs font-mono">{'{}'}</span>,
      action: () => editorRef.current?.insertMarkdown('\n```\n\n```\n'),
      keywords: ['code', 'block'],
    });
    items.push({
      key: 'divider',
      label: 'Divider',
      icon: <span className="text-xs">—</span>,
      action: () => editorRef.current?.insertMarkdown('\n---\n'),
      keywords: ['divider', 'hr', 'horizontal', 'rule'],
    });
    items.push({
      key: 'table',
      label: 'Table',
      icon: <span className="text-xs">⊞</span>,
      action: () => editorRef.current?.insertMarkdown('\n| Col 1 | Col 2 |\n| --- | --- |\n| Cell | Cell |\n'),
      keywords: ['table', 'grid'],
    });

    if (richtext?.embeds?.images) {
      items.push({
        key: 'cms-image',
        label: 'CMS Image',
        description: 'Insert from media library',
        icon: <ImagePlus className="octo-icon-md" />,
        action: () => insertJsxRef.current?.({ kind: 'flow', name: 'CmsImage', props: { mediaId: '' } }),
        keywords: ['image', 'media', 'picture', 'photo'],
      });
    }

    if (richtext?.embeds?.references) {
      items.push({
        key: 'cms-ref',
        label: 'Entry Reference',
        description: 'Embed a content entry',
        icon: <FileText className="octo-icon-md" />,
        action: () => insertJsxRef.current?.({ kind: 'flow', name: 'CmsRef', props: { id: '', display: 'block' } }),
        keywords: ['reference', 'entry', 'link', 'embed'],
      });
    }

    if (richtext?.embeds?.conditions) {
      items.push({
        key: 'cms-condition',
        label: 'Condition Block',
        description: 'A/B content branches',
        icon: <GitBranch className="octo-icon-md" />,
        action: () => insertJsxRef.current?.({ kind: 'flow', name: 'CmsCondition', props: { field: '' } }),
        keywords: ['condition', 'branch', 'ab', 'test'],
      });
    }

    const vars = richtext?.embeds?.variables;
    if (vars && vars.length > 0) {
      items.push({
        key: 'cms-var',
        label: 'Template Variable',
        description: 'Dynamic value placeholder',
        icon: <Variable className="octo-icon-md" />,
        action: () => insertJsxRef.current?.({ kind: 'text', name: 'CmsVar', props: { name: vars[0] ?? '' } }),
        keywords: ['variable', 'template', 'dynamic'],
      });
    }

    const customComponents = richtext?.embeds?.components;
    if (customComponents) {
      for (const [cName, def] of Object.entries(customComponents)) {
        const defaultProps: Record<string, string> = {};
        for (const p of def.props) {
          defaultProps[p.name] = p.defaultValue != null ? String(p.defaultValue) : '';
        }
        items.push({
          key: `component-${cName}`,
          label: def.label,
          description: `Component: ${cName}`,
          icon: <Puzzle className="octo-icon-md" />,
          action: () =>
            insertJsxRef.current?.({
              kind: def.kind === 'inline' ? 'text' : 'flow',
              name: cName,
              props: defaultProps,
            }),
          keywords: ['component', cName.toLowerCase(), def.label.toLowerCase()],
        });
      }
    }

    return items;
  }, [richtext]);

  const filteredSlashItems = slashFilter
    ? slashItems.filter((item) => {
        const q = slashFilter.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.keywords?.some((kw) => kw.includes(q))
        );
      })
    : slashItems;

  // Listen for '/' typed in the editor to open the command menu
  useEffect(() => {
    const wrapper = editorWrapRef.current;
    if (!wrapper) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !slashOpen) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          if (!wrapper.contains(range.commonAncestorContainer)) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          const rect = range.getBoundingClientRect();
          setSlashPosition({ top: rect.bottom + 4, left: rect.left });
          setSlashFilter('');
          setSlashOpen(true);
        }
      } else if (slashOpen) {
        if (e.key === 'Escape') {
          setSlashOpen(false);
        } else if (e.key === 'Backspace') {
          setSlashFilter((prev) => {
            if (prev.length === 0) {
              setSlashOpen(false);
              return '';
            }
            return prev.slice(0, -1);
          });
          e.preventDefault();
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          setSlashFilter((prev) => prev + e.key);
          e.preventDefault();
        }
      }
    };

    wrapper.addEventListener('keydown', handleKeyDown, true);
    return () => wrapper.removeEventListener('keydown', handleKeyDown, true);
  }, [slashOpen]);

  const handleSlashSelect = useCallback(
    (item: (typeof slashItems)[number]) => {
      setSlashOpen(false);
      // Remove the '/' and any filter text that was typed
      const md = editorRef.current?.getMarkdown() ?? '';
      const slashPrefix = '/' + slashFilter;
      if (md.endsWith(slashPrefix)) {
        editorRef.current?.setMarkdown(md.slice(0, -slashPrefix.length));
      }
      item.action();
    },
    [slashFilter],
  );

  const handleSlashClose = useCallback(() => {
    setSlashOpen(false);
  }, []);

  const allowedVariables = useMemo(() => richtext?.embeds?.variables ?? [], [richtext]);

  const jsxDescriptors = useMemo(() => {
    const descriptors: JsxComponentDescriptor[] = [];
    if (richtext?.embeds?.images) {
      descriptors.push(CMS_IMAGE_DESCRIPTOR);
    }
    if (richtext?.embeds?.references) {
      descriptors.push(CMS_REFERENCE_DESCRIPTOR);
    }
    if (allowedVariables.length > 0) {
      descriptors.push(buildCmsVarDescriptor(allowedVariables));
    }
    if (richtext?.embeds?.conditions) {
      descriptors.push(CMS_CONDITION_DESCRIPTOR);
      descriptors.push(CMS_BRANCH_DESCRIPTOR);
    }
    const customComponents = richtext?.embeds?.components;
    if (customComponents) {
      for (const [name, def] of Object.entries(customComponents)) {
        descriptors.push(buildCustomComponentDescriptor(name, def));
      }
    }
    return descriptors;
  }, [richtext, allowedVariables]);

  const hasImageEmbeds = richtext?.embeds?.images === true;
  const hasReferenceEmbeds = !!richtext?.embeds?.references;
  const hasConditions = richtext?.embeds?.conditions === true;
  const hasVariables = allowedVariables.length > 0;
  const customComponents = richtext?.embeds?.components;
  const hasCustomComponents = !!customComponents && Object.keys(customComponents).length > 0;

  // Toolbar config — all buttons shown by default
  const tb = richtext?.toolbar;
  const showFormatting = tb?.formatting !== false;
  const showHeadings = tb?.headings !== false;
  const showLists = tb?.lists !== false;
  const showCode = tb?.code !== false;
  const showCodeBlock = tb?.codeBlock !== false;
  const showLinks = tb?.links !== false;
  const showTables = tb?.tables !== false;
  const showThematicBreak = tb?.thematicBreak !== false;
  const showImages = tb?.images !== false;
  const showUndoRedo = tb?.undoRedo !== false;

  const hasAnyEmbeds = hasImageEmbeds || hasReferenceEmbeds || hasConditions || hasVariables || hasCustomComponents;

  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      imagePlugin(),
      tablePlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: '' }),
      markdownShortcutPlugin(),
      ...(jsxDescriptors.length > 0 ? [jsxPlugin({ jsxComponentDescriptors: jsxDescriptors })] : []),
      toolbarPlugin({
        toolbarContents: () => (
          <>
            <InsertJsxPublisherBridge targetRef={insertJsxRef} />
            {showUndoRedo && <UndoRedo />}
            {showFormatting && <BoldItalicUnderlineToggles />}
            {showCode && <CodeToggle />}
            {showLinks && <CreateLink />}
            {showLists && <ListsToggle />}
            {showHeadings && <BlockTypeSelect />}
            {showTables && <InsertTable />}
            {showThematicBreak && <InsertThematicBreak />}
            {showImages && <InsertImage />}
            {showCodeBlock && <InsertCodeBlock />}
            {hasAnyEmbeds && <Separator />}
            {hasImageEmbeds && <InsertCmsImageButton />}
            {hasReferenceEmbeds && <InsertCmsRefButton />}
            {hasConditions && <InsertCmsConditionButton />}
            {hasVariables && <InsertCmsVarButton variables={allowedVariables} />}
            {hasCustomComponents && <InsertCustomComponentButton components={customComponents!} />}
          </>
        ),
      }),
    ],
    [
      jsxDescriptors,
      hasImageEmbeds,
      hasReferenceEmbeds,
      hasConditions,
      hasVariables,
      allowedVariables,
      hasCustomComponents,
      customComponents,
      hasAnyEmbeds,
      showFormatting,
      showHeadings,
      showLists,
      showCode,
      showCodeBlock,
      showLinks,
      showTables,
      showThematicBreak,
      showImages,
      showUndoRedo,
    ],
  );

  return (
    <div className="octo-ff-richtext">
      <div className="octo-ff-richtext__label">
        {label}
        {required ? <span className="octo-ff-richtext__required">*</span> : null}
      </div>
      <input type="hidden" ref={hiddenInputRef} name={name} defaultValue={value} />
      <div ref={editorWrapRef} className="octo-ff-richtext__editor-wrap">
        <MDXEditor
          markdown={value}
          plugins={plugins}
          ref={editorRef}
          onChange={onChange}
          className={cn('editor-markdown', error && 'editor-markdown--invalid')}
        />
        <SlashMenuOverlay
          items={filteredSlashItems}
          open={slashOpen}
          filter={slashFilter}
          position={slashPosition}
          onSelect={handleSlashSelect}
          onClose={handleSlashClose}
        />
      </div>
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormRichTextField;
