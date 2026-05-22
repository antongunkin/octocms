import React from 'react';

import Markdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

/**
 * Sanitization schema: extends the default GitHub-flavoured schema with
 * the same tag/attribute allowlist that was previously applied via sanitize-html.
 */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'u', // underline — not in GitHub default
  ],
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), 'className'],
    img: ['src', 'alt', 'title'],
  },
};

type MarkdownContentProps = {
  children: string | undefined | null;
  className?: string;
};

/**
 * Renders raw Markdown as React elements using react-markdown with GFM support
 * and HTML sanitization. Replaces the previous `dangerouslySetInnerHTML` approach.
 */
const MarkdownContent = ({ children, className }: MarkdownContentProps) => {
  if (!children) {
    return null;
  }

  return (
    <div className={`octo-markdown-content${className ? ` ${className}` : ''}`}>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}>
        {children}
      </Markdown>
    </div>
  );
};

export default MarkdownContent;
