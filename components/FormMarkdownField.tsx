'use client';

import React, { useRef, useEffect } from 'react';

import {
  MDXEditorMethods,
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  CreateLink,
  BlockTypeSelect,
  ListsToggle,
  BoldItalicUnderlineToggles,
  toolbarPlugin,
} from '@mdxeditor/editor';

import { cn } from '../lib/utils';

import { ErrorBoundary } from './ErrorBoundary';
import { FieldHintAndError } from './FieldHintAndError';

type FormMarkdownFieldProps = {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  hint?: string;
  error?: string;
  onClearError?: (name: string) => void;
};

const FormMarkdownField = ({ label, name, value, required, hint, error, onClearError }: FormMarkdownFieldProps) => {
  const markdownFieldRef = useRef<MDXEditorMethods>(null);
  const markdownTextareRef = useRef<HTMLInputElement>(null);

  const onMarkdownChange = () => {
    const input = markdownTextareRef.current;
    if (input) {
      input.value = markdownFieldRef.current?.getMarkdown() || '';
    }
    onClearError?.(name);
  };

  useEffect(() => {
    markdownFieldRef.current?.setMarkdown(value);
  }, [value]);

  return (
    <div className="mb-6">
      <div className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
        {required ? <span className="text-destructive ml-1">*</span> : null}
      </div>
      <input type="hidden" ref={markdownTextareRef} name={name} defaultValue={value} />
      <ErrorBoundary label="markdown editor">
        <MDXEditor
          markdown=""
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            toolbarPlugin({
              toolbarContents: () => (
                <>
                  <BoldItalicUnderlineToggles />
                  <CreateLink />
                  <ListsToggle />
                  <BlockTypeSelect />
                </>
              ),
            }),
          ]}
          ref={markdownFieldRef}
          onChange={onMarkdownChange}
          className={cn('editor-markdown', error && 'editor-markdown--invalid')}
        />
      </ErrorBoundary>
      <FieldHintAndError hint={hint} error={error} />
    </div>
  );
};

export default FormMarkdownField;
