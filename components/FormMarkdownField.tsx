'use client';

import React, { useRef, useEffect } from 'react';

import {
  MDXEditorMethods,
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  imagePlugin,
  CreateLink,
  BlockTypeSelect,
  ListsToggle,
  BoldItalicUnderlineToggles,
  InsertImage,
  toolbarPlugin,
} from '@mdxeditor/editor';

import { useUploadMedia } from '../admin/query/hooks/useMediaMutations';
import { toast } from '../hooks/useToast';
import { suggestedTitleFromFileName } from '../lib/suggestedMediaTitle';
import { cn } from '../lib/utils';

import { ErrorBoundary } from './ErrorBoundary';
import { FieldHintAndError } from './FieldHintAndError';
import { MarkdownImageEditToolbar } from './MediaManager/MarkdownImageEditToolbar';
import { MarkdownInsertImageDialog } from './MediaManager/MarkdownInsertImageDialog';

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
  const uploadMutation = useUploadMedia();

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

  // Inline-image upload handler for the toolbar's Insert Image button.
  // Reuses the same `uploadMedia` action as the Media library, so an image
  // inserted here lands as a real media entry under `/cms/media` and gets the
  // same blur placeholder + dimensions extraction. The default title is the
  // filename stem; users can refine it later in the Media library.
  const handleImageUpload = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.set('file', file);
    fd.set('folder', '/');
    fd.set('title', suggestedTitleFromFileName(file.name));
    fd.set('generateBlur', '1');
    try {
      const result = await uploadMutation.mutateAsync(fd);
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      return `/media/${result.id}.${ext}`;
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : 'Image upload failed',
        variant: 'destructive',
      });
      throw e;
    }
  };

  return (
    <div className="octo-ff-markdown">
      <div className="octo-ff-markdown__label">
        {label}
        {required ? <span className="octo-ff-markdown__required">*</span> : null}
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
            imagePlugin({
              imageUploadHandler: handleImageUpload,
              ImageDialog: MarkdownInsertImageDialog,
              // The plugin's public type is `FC<{}>` but the runtime passes
              // EditImageToolbarProps (nodeKey/imageSource/alt/title/...) — see
              // node_modules/@mdxeditor/editor/dist/plugins/image/EditImageToolbar.js
              // for the actual call site. Cast away the type narrowing.
              EditImageToolbar: MarkdownImageEditToolbar as unknown as React.FC,
            }),
            toolbarPlugin({
              toolbarContents: () => (
                <>
                  <BoldItalicUnderlineToggles />
                  <CreateLink />
                  <InsertImage />
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
