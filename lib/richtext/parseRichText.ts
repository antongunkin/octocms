import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import type { RichTextDocument, RichTextNode, ResolvedImageField } from '../../types';

// ---------------------------------------------------------------------------
// MDX string → RichTextDocument AST
// ---------------------------------------------------------------------------

type ImageResolver = (mediaId: string) => Promise<ResolvedImageField | null>;
type ReferenceResolver = (refKey: string) => Promise<unknown | null>;

type ParseOptions = {
  /** Async resolver that turns a media UUID into a ResolvedImageField. */
  resolveImage?: ImageResolver;
  /** Async resolver that turns a reference key (e.g. 'post-abc.json') into a full entry object. */
  resolveReference?: ReferenceResolver;
};

const parser = unified().use(remarkParse).use(remarkMdx);

/**
 * Parse an MDX string into a `RichTextDocument` AST.
 *
 * - Standard markdown nodes are converted to `RichTextNode` types.
 * - `<CmsImage mediaId="uuid" />` JSX tags are resolved to `{ type: 'image' }` nodes
 *   using the provided `resolveImage` callback.
 * - Other JSX tags are passed through as `{ type: 'component' }` nodes for future phases.
 */
export async function parseRichText(mdx: string, options: ParseOptions = {}): Promise<RichTextDocument> {
  const tree = parser.parse(mdx);
  const content = await convertChildren(tree.children as any[], options);
  return { type: 'doc', content };
}

// ---------------------------------------------------------------------------
// mdast → RichTextNode converters
// ---------------------------------------------------------------------------

async function convertChildren(nodes: any[], options: ParseOptions): Promise<RichTextNode[]> {
  const result: RichTextNode[] = [];
  for (const node of nodes) {
    const converted = await convertNode(node, options);
    if (converted) result.push(converted);
  }
  return result;
}

async function convertNode(node: any, options: ParseOptions): Promise<RichTextNode | null> {
  switch (node.type) {
    case 'paragraph':
      return { type: 'paragraph', children: await convertInlineChildren(node.children ?? [], options) };

    case 'heading':
      return {
        type: 'heading',
        level: node.depth as 1 | 2 | 3 | 4 | 5 | 6,
        children: await convertInlineChildren(node.children ?? [], options),
      };

    case 'blockquote':
      return { type: 'blockquote', children: await convertChildren(node.children ?? [], options) };

    case 'list':
      return {
        type: 'list',
        ordered: !!node.ordered,
        children: await convertChildren(node.children ?? [], options),
      };

    case 'listItem':
      return { type: 'listItem', children: await convertChildren(node.children ?? [], options) };

    case 'thematicBreak':
      return { type: 'thematicBreak' };

    case 'code':
      return { type: 'code', lang: node.lang ?? undefined, value: node.value ?? '' };

    case 'html':
      return { type: 'html', value: node.value ?? '' };

    // MDX JSX flow elements (block-level): <CmsImage />, custom components
    case 'mdxJsxFlowElement':
      return convertJsxElement(node, options);

    // Inline JSX in a paragraph context can appear at block level in some cases
    case 'mdxJsxTextElement':
      return convertJsxElement(node, options);

    default:
      return null;
  }
}

async function convertInlineChildren(nodes: any[], options: ParseOptions): Promise<RichTextNode[]> {
  const result: RichTextNode[] = [];
  for (const node of nodes) {
    const converted = await convertInlineNode(node, options);
    if (converted) result.push(converted);
  }
  return result;
}

async function convertInlineNode(node: any, options: ParseOptions): Promise<RichTextNode | null> {
  switch (node.type) {
    case 'text':
      return { type: 'text', value: node.value ?? '' };

    case 'strong':
      return wrapMarks(await convertInlineChildren(node.children ?? [], options), 'bold');

    case 'emphasis':
      return wrapMarks(await convertInlineChildren(node.children ?? [], options), 'italic');

    case 'inlineCode':
      return { type: 'text', value: node.value ?? '', marks: ['code'] };

    case 'link':
      return {
        type: 'link',
        url: node.url ?? '',
        children: await convertInlineChildren(node.children ?? [], options),
      };

    case 'image':
      // Standard markdown images — produce a resolved image node from the URL
      return {
        type: 'image',
        image: { src: node.url ?? '', alt: node.alt ?? '', width: null, height: null, blurDataURL: null },
      };

    case 'break':
      return { type: 'break' };

    case 'html':
      return { type: 'html', value: node.value ?? '' };

    case 'mdxJsxTextElement':
      return convertJsxElement(node, options);

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// JSX element handling — CmsImage + pass-through for future types
// ---------------------------------------------------------------------------

function getJsxAttr(node: any, name: string): string | undefined {
  const attr = (node.attributes ?? []).find((a: any) => a.type === 'mdxJsxAttribute' && a.name === name);
  if (!attr) return undefined;
  if (typeof attr.value === 'string') return attr.value;
  return undefined;
}

function getJsxProps(node: any): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const attr of node.attributes ?? []) {
    if (attr.type === 'mdxJsxAttribute' && typeof attr.name === 'string') {
      props[attr.name] = typeof attr.value === 'string' ? attr.value : (attr.value?.value ?? null);
    }
  }
  return props;
}

async function convertJsxElement(node: any, options: ParseOptions): Promise<RichTextNode | null> {
  const name = node.name as string | null;
  if (!name) return null;

  // CmsImage — resolve media UUID to ResolvedImageField
  if (name === 'CmsImage') {
    const mediaId = getJsxAttr(node, 'mediaId');
    if (mediaId && options.resolveImage) {
      const resolved = await options.resolveImage(mediaId);
      if (resolved) {
        return { type: 'image', image: resolved };
      }
    }
    // Fallback: unresolved or missing resolver
    return {
      type: 'image',
      image: { src: '', alt: '', width: null, height: null, blurDataURL: null },
    };
  }

  // CmsRef — resolve reference key to full entry object
  if (name === 'CmsRef') {
    const id = getJsxAttr(node, 'id');
    const display = (getJsxAttr(node, 'display') || 'block') as 'inline' | 'block';
    if (id && options.resolveReference) {
      const resolved = await options.resolveReference(id);
      if (resolved) {
        return { type: 'reference', entry: resolved, display };
      }
    }
    // Fallback: unresolved or missing resolver
    return { type: 'reference', entry: null, display };
  }

  // CmsVar — template variable, pass through as a variable node
  if (name === 'CmsVar') {
    const varName = getJsxAttr(node, 'name');
    if (varName) {
      return { type: 'variable', name: varName };
    }
    return null;
  }

  // CmsCondition — conditional content with CmsBranch children
  if (name === 'CmsCondition') {
    const field = getJsxAttr(node, 'field') ?? '';
    const branches: Record<string, RichTextDocument> = {};
    for (const child of node.children ?? []) {
      if ((child.type === 'mdxJsxFlowElement' || child.type === 'mdxJsxTextElement') && child.name === 'CmsBranch') {
        const branchKey = getJsxAttr(child, 'key');
        if (branchKey) {
          const branchContent = await convertChildren(child.children ?? [], options);
          branches[branchKey] = { type: 'doc', content: branchContent };
        }
      }
    }
    return { type: 'condition', field, branches };
  }

  // CmsBranch outside of CmsCondition — skip (rendered by parent)
  if (name === 'CmsBranch') {
    return null;
  }

  // All other JSX tags → pass through as 'component'
  const props = getJsxProps(node);
  const children = node.children?.length ? await convertChildren(node.children, options) : undefined;
  return { type: 'component', name, props, children };
}

// ---------------------------------------------------------------------------
// Mark merging helper
// ---------------------------------------------------------------------------

type Mark = 'bold' | 'italic' | 'underline' | 'code';

function wrapMarks(children: RichTextNode[], mark: Mark): RichTextNode | null {
  if (children.length === 0) return null;
  // If the children are all text nodes, add the mark directly
  if (children.length === 1 && children[0].type === 'text') {
    const textNode = children[0];
    return { type: 'text', value: textNode.value, marks: [...(textNode.marks ?? []), mark] };
  }
  // For nested marks (e.g. bold+italic), propagate the mark to all text descendants
  return mergeMarkIntoChildren(children, mark);
}

function mergeMarkIntoChildren(children: RichTextNode[], mark: Mark): RichTextNode | null {
  const merged: RichTextNode[] = children.map((child) => {
    if (child.type === 'text') {
      return { ...child, marks: [...(child.marks ?? []), mark] };
    }
    return child;
  });
  // If only one child after merging, return it directly
  if (merged.length === 1) return merged[0];
  // Wrap in a paragraph as a container (inline context)
  return { type: 'paragraph', children: merged };
}
