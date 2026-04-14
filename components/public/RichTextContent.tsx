import React from 'react';
import Image from 'next/image';

import type { RichTextDocument, RichTextNode, ResolvedImageField } from '../../types';
import { cn } from '../../lib/utils';

type RichTextContentProps = {
  document: RichTextDocument | null | undefined;
  /** Map custom component names to React components for rendering `{ type: 'component' }` nodes. */
  components?: Record<string, React.ComponentType<any>>;
  /** Variable substitutions for `{ type: 'variable' }` nodes. */
  variables?: Record<string, string>;
  /** Condition branch selections: map condition field names to the branch key to render. */
  conditions?: Record<string, string>;
  className?: string;
};

/**
 * Renders a `RichTextDocument` AST to React elements.
 *
 * Standard markdown nodes become HTML elements.
 * `CmsImage` embeds render as `next/image`.
 * Custom components and variables are resolved from the provided props.
 */
const RichTextContent = ({ document, components, variables, conditions, className }: RichTextContentProps) => {
  if (!document || !document.content?.length) return null;
  return (
    <div className={cn(className)}>
      {document.content.map((node, i) => (
        <RenderNode key={i} node={node} components={components} variables={variables} conditions={conditions} />
      ))}
    </div>
  );
};

export default RichTextContent;

// ---------------------------------------------------------------------------
// Internal node renderer
// ---------------------------------------------------------------------------

type NodeProps = {
  node: RichTextNode;
  components?: Record<string, React.ComponentType<any>>;
  variables?: Record<string, string>;
  conditions?: Record<string, string>;
};

function RenderNode({ node, components, variables, conditions }: NodeProps) {
  switch (node.type) {
    case 'paragraph':
      return (
        <p>
          <RenderChildren nodes={node.children} components={components} variables={variables} conditions={conditions} />
        </p>
      );

    case 'heading': {
      const Tag = `h${node.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      return (
        <Tag>
          <RenderChildren nodes={node.children} components={components} variables={variables} conditions={conditions} />
        </Tag>
      );
    }

    case 'blockquote':
      return (
        <blockquote>
          <RenderChildren nodes={node.children} components={components} variables={variables} conditions={conditions} />
        </blockquote>
      );

    case 'list':
      if (node.ordered) {
        return (
          <ol>
            <RenderChildren
              nodes={node.children}
              components={components}
              variables={variables}
              conditions={conditions}
            />
          </ol>
        );
      }
      return (
        <ul>
          <RenderChildren nodes={node.children} components={components} variables={variables} conditions={conditions} />
        </ul>
      );

    case 'listItem':
      return (
        <li>
          <RenderChildren nodes={node.children} components={components} variables={variables} conditions={conditions} />
        </li>
      );

    case 'thematicBreak':
      return <hr />;

    case 'code':
      return (
        <pre>
          <code className={node.lang ? `language-${node.lang}` : undefined}>{node.value}</code>
        </pre>
      );

    case 'text':
      return <RenderText node={node} />;

    case 'link':
      return (
        <a href={node.url}>
          <RenderChildren nodes={node.children} components={components} variables={variables} conditions={conditions} />
        </a>
      );

    case 'image':
      return <RenderImage image={node.image} />;

    case 'break':
      return <br />;

    case 'html':
      return null;

    case 'variable': {
      const value = variables?.[node.name];
      return <>{value ?? `{${node.name}}`}</>;
    }

    case 'component': {
      const Component = components?.[node.name];
      if (!Component) return null;
      return (
        <Component {...node.props}>
          {node.children?.length ? (
            <RenderChildren
              nodes={node.children}
              components={components}
              variables={variables}
              conditions={conditions}
            />
          ) : null}
        </Component>
      );
    }

    case 'reference':
      return <RenderReference node={node} components={components} />;

    case 'condition':
      return <RenderCondition node={node} components={components} variables={variables} conditions={conditions} />;

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Inline text with marks
// ---------------------------------------------------------------------------

function RenderText({ node }: { node: Extract<RichTextNode, { type: 'text' }> }) {
  let element: React.ReactNode = node.value;
  if (node.marks) {
    for (const mark of node.marks) {
      switch (mark) {
        case 'bold':
          element = <strong>{element}</strong>;
          break;
        case 'italic':
          element = <em>{element}</em>;
          break;
        case 'underline':
          element = <u>{element}</u>;
          break;
        case 'code':
          element = <code>{element}</code>;
          break;
      }
    }
  }
  return <>{element}</>;
}

// ---------------------------------------------------------------------------
// Image rendering via next/image
// ---------------------------------------------------------------------------

function RenderImage({ image }: { image: ResolvedImageField }) {
  if (!image.src) return null;

  const hasSize = image.width != null && image.height != null;

  if (hasSize) {
    return (
      <Image
        src={image.src}
        alt={image.alt}
        width={image.width!}
        height={image.height!}
        {...(image.blurDataURL ? { placeholder: 'blur' as const, blurDataURL: image.blurDataURL } : {})}
      />
    );
  }

  // Fallback for images without dimensions — use fill with a container
  return (
    <span className="relative block w-full" style={{ aspectRatio: '16/9' }}>
      <Image
        src={image.src}
        alt={image.alt}
        fill
        className="object-cover"
        {...(image.blurDataURL ? { placeholder: 'blur' as const, blurDataURL: image.blurDataURL } : {})}
      />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Reference rendering — embedded entry references
// ---------------------------------------------------------------------------

type ReferenceNode = Extract<RichTextNode, { type: 'reference' }>;

function RenderReference({
  node,
  components,
}: {
  node: ReferenceNode;
  components?: Record<string, React.ComponentType<any>>;
}) {
  const entry = node.entry as { sys?: { type?: string }; fields?: Record<string, unknown> } | null;
  if (!entry) return null;

  const collectionType = entry.sys?.type;

  // If consumer provided a custom component for this collection type, use it
  if (collectionType && components?.[collectionType]) {
    const Component = components[collectionType];
    return node.display === 'inline' ? (
      <Component entry={entry} display={node.display} />
    ) : (
      <div>
        <Component entry={entry} display={node.display} />
      </div>
    );
  }

  // Default fallback: show the entry's title field if available
  const title = entry.fields
    ? (Object.values(entry.fields).find((v) => typeof v === 'string' && v.length > 0) as string | undefined)
    : null;

  if (node.display === 'inline') {
    return <span>{title ?? collectionType ?? 'Reference'}</span>;
  }

  return (
    <div className="rounded border border-border p-3 my-2 bg-muted/30">
      {collectionType && <span className="text-xs text-muted-foreground block mb-0.5">{collectionType}</span>}
      <span className="text-sm font-medium">{title ?? 'Untitled entry'}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Condition rendering — select and render the appropriate branch
// ---------------------------------------------------------------------------

type ConditionNode = Extract<RichTextNode, { type: 'condition' }>;

function RenderCondition({
  node,
  components,
  variables,
  conditions,
}: {
  node: ConditionNode;
  components?: Record<string, React.ComponentType<any>>;
  variables?: Record<string, string>;
  conditions?: Record<string, string>;
}) {
  const branches = node.branches;
  if (!branches || typeof branches !== 'object') return null;

  // If a condition selection was provided, render only the selected branch
  const selectedKey = node.field && conditions ? conditions[node.field] : undefined;

  if (selectedKey) {
    const doc = (branches as Record<string, RichTextDocument>)[selectedKey];
    if (!doc || !doc.content?.length) return null;
    return (
      <>
        {doc.content.map((child, i) => (
          <RenderNode key={i} node={child} components={components} variables={variables} conditions={conditions} />
        ))}
      </>
    );
  }

  // No condition provided — render nothing (consumer must specify which branch to show)
  return null;
}

// ---------------------------------------------------------------------------
// Helper: render a list of child nodes
// ---------------------------------------------------------------------------

function RenderChildren({
  nodes,
  components,
  variables,
  conditions,
}: { nodes: RichTextNode[] } & Pick<NodeProps, 'components' | 'variables' | 'conditions'>) {
  return (
    <>
      {nodes.map((child, i) => (
        <RenderNode key={i} node={child} components={components} variables={variables} conditions={conditions} />
      ))}
    </>
  );
}
