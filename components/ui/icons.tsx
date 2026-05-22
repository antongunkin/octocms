/**
 * Vendored icon nodes (ISC).
 * This file intentionally contains only icons used in this repository.
 */
import { createElement, forwardRef } from 'react';
import type { SVGProps } from 'react';

type IconNode = ReadonlyArray<readonly [string, Record<string, string | number>]>;

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'color'> & {
  color?: string;
  size?: number | string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
};

const DEFAULT_ATTRIBUTES = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function joinClasses(...parts: Array<string | undefined>): string | undefined {
  const value = parts.filter(Boolean).join(' ');
  return value.length > 0 ? value : undefined;
}

function hasA11yProp(props: SVGProps<SVGSVGElement>): boolean {
  return 'aria-label' in props || 'aria-labelledby' in props || 'role' in props;
}

function createIcon(iconName: string, iconNode: IconNode) {
  const IconComponent = forwardRef<SVGSVGElement, IconProps>(
    ({ color, size, strokeWidth, absoluteStrokeWidth, className, children, ...rest }, ref) => {
      const resolvedSize = size ?? DEFAULT_ATTRIBUTES.width;
      const baseStroke = Number(strokeWidth ?? DEFAULT_ATTRIBUTES.strokeWidth);
      const resolvedStrokeWidth =
        absoluteStrokeWidth === true
          ? (baseStroke * 24) / Number(resolvedSize)
          : (strokeWidth ?? DEFAULT_ATTRIBUTES.strokeWidth);

      return createElement(
        'svg',
        {
          ref,
          ...DEFAULT_ATTRIBUTES,
          width: resolvedSize,
          height: resolvedSize,
          stroke: color ?? DEFAULT_ATTRIBUTES.stroke,
          strokeWidth: resolvedStrokeWidth,
          className: joinClasses('lucide', 'lucide-' + iconName, className),
          ...(!children && !hasA11yProp(rest) ? { 'aria-hidden': 'true' } : {}),
          ...rest,
        },
        [
          ...iconNode.map(([tag, attrs]) => createElement(tag, attrs)),
          ...(Array.isArray(children) ? children : [children]),
        ],
      );
    },
  );
  IconComponent.displayName = iconName;
  return IconComponent;
}

const ArrowLeftNode: IconNode = [
  ['path', { d: 'm12 19-7-7 7-7', key: '1l729n' }],
  ['path', { d: 'M19 12H5', key: 'x3x0zl' }],
] as const;
export const ArrowLeft = createIcon('arrow-left', ArrowLeftNode);

const ArrowRightNode: IconNode = [
  ['path', { d: 'M5 12h14', key: '1ays0h' }],
  ['path', { d: 'm12 5 7 7-7 7', key: 'xquz4c' }],
] as const;
export const ArrowRight = createIcon('arrow-right', ArrowRightNode);

const ArrowUpRightNode: IconNode = [
  ['path', { d: 'M7 7h10v10', key: '1tivn9' }],
  ['path', { d: 'M7 17 17 7', key: '1vkiza' }],
] as const;
export const ArrowUpRight = createIcon('arrow-up-right', ArrowUpRightNode);

const BellNode: IconNode = [
  ['path', { d: 'M10.268 21a2 2 0 0 0 3.464 0', key: 'vwvbt9' }],
  [
    'path',
    {
      d: 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326',
      key: '11g9vi',
    },
  ],
] as const;
export const Bell = createIcon('bell', BellNode);

const BotNode: IconNode = [
  ['path', { d: 'M12 8V4H8', key: 'hb8ula' }],
  ['rect', { width: '16', height: '12', x: '4', y: '8', rx: '2', key: 'enze0r' }],
  ['path', { d: 'M2 14h2', key: 'vft8re' }],
  ['path', { d: 'M20 14h2', key: '4cs60a' }],
  ['path', { d: 'M15 13v2', key: '1xurst' }],
  ['path', { d: 'M9 13v2', key: 'rq6x2g' }],
] as const;
export const Bot = createIcon('bot', BotNode);

const CheckCheckNode: IconNode = [
  ['path', { d: 'M18 6 7 17l-5-5', key: '116fxf' }],
  ['path', { d: 'm22 10-7.5 7.5L13 16', key: 'ke71qq' }],
] as const;
export const CheckCheck = createIcon('check-check', CheckCheckNode);

const CheckNode: IconNode = [['path', { d: 'M20 6 9 17l-5-5', key: '1gmf2c' }]] as const;
export const Check = createIcon('check', CheckNode);

const ChevronDownNode: IconNode = [['path', { d: 'm6 9 6 6 6-6', key: 'qrunsl' }]] as const;
export const ChevronDown = createIcon('chevron-down', ChevronDownNode);

const ChevronLeftNode: IconNode = [['path', { d: 'm15 18-6-6 6-6', key: '1wnfg3' }]] as const;
export const ChevronLeft = createIcon('chevron-left', ChevronLeftNode);

const ChevronRightNode: IconNode = [['path', { d: 'm9 18 6-6-6-6', key: 'mthhwq' }]] as const;
export const ChevronRight = createIcon('chevron-right', ChevronRightNode);

const ChevronUpNode: IconNode = [['path', { d: 'm18 15-6-6-6 6', key: '153udz' }]] as const;
export const ChevronUp = createIcon('chevron-up', ChevronUpNode);

const AlertCircleNode: IconNode = [
  ['circle', { cx: '12', cy: '12', r: '10', key: '1mglay' }],
  ['line', { x1: '12', x2: '12', y1: '8', y2: '12', key: '1pkeuh' }],
  ['line', { x1: '12', x2: '12.01', y1: '16', y2: '16', key: '4dfq90' }],
] as const;
export const AlertCircle = createIcon('circle-alert', AlertCircleNode);

const CircleCheckNode: IconNode = [
  ['circle', { cx: '12', cy: '12', r: '10', key: '1mglay' }],
  ['path', { d: 'm9 12 2 2 4-4', key: 'dzmm74' }],
] as const;
export const CircleCheck = createIcon('circle-check', CircleCheckNode);
export const CheckCircle2 = CircleCheck;

const StopCircleNode: IconNode = [
  ['circle', { cx: '12', cy: '12', r: '10', key: '1mglay' }],
  ['rect', { x: '9', y: '9', width: '6', height: '6', rx: '1', key: '1ssd4o' }],
] as const;
export const StopCircle = createIcon('circle-stop', StopCircleNode);

const CircleNode: IconNode = [['circle', { cx: '12', cy: '12', r: '10', key: '1mglay' }]] as const;
export const Circle = createIcon('circle', CircleNode);

const CloudUploadNode: IconNode = [
  ['path', { d: 'M12 13v8', key: '1l5pq0' }],
  ['path', { d: 'M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242', key: '1pljnt' }],
  ['path', { d: 'm8 17 4-4 4 4', key: '1quai1' }],
] as const;
export const CloudUpload = createIcon('cloud-upload', CloudUploadNode);

const MoreHorizontalNode: IconNode = [
  ['circle', { cx: '12', cy: '12', r: '1', key: '41hilf' }],
  ['circle', { cx: '19', cy: '12', r: '1', key: '1wjl8i' }],
  ['circle', { cx: '5', cy: '12', r: '1', key: '1pcz8c' }],
] as const;
export const MoreHorizontal = createIcon('ellipsis', MoreHorizontalNode);

const ExternalLinkNode: IconNode = [
  ['path', { d: 'M15 3h6v6', key: '1q9fwt' }],
  ['path', { d: 'M10 14 21 3', key: 'gplh6r' }],
  ['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', key: 'a6xqqp' }],
] as const;
export const ExternalLink = createIcon('external-link', ExternalLinkNode);

const FileCode2Node: IconNode = [
  [
    'path',
    {
      d: 'M4 12.15V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2h-3.35',
      key: '1wthlu',
    },
  ],
  ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5', key: 'wfsgrz' }],
  ['path', { d: 'm5 16-3 3 3 3', key: '331omg' }],
  ['path', { d: 'm9 22 3-3-3-3', key: 'lsp7cz' }],
] as const;
export const FileCode2 = createIcon('file-code-corner', FileCode2Node);

const FilePenNode: IconNode = [
  [
    'path',
    {
      d: 'M12.659 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v9.34',
      key: 'o6klzx',
    },
  ],
  ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5', key: 'wfsgrz' }],
  [
    'path',
    {
      d: 'M10.378 12.622a1 1 0 0 1 3 3.003L8.36 20.637a2 2 0 0 1-.854.506l-2.867.837a.5.5 0 0 1-.62-.62l.836-2.869a2 2 0 0 1 .506-.853z',
      key: 'zhnas1',
    },
  ],
] as const;
export const FilePen = createIcon('file-pen', FilePenNode);

const FilePlusNode: IconNode = [
  [
    'path',
    {
      d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z',
      key: '1oefj6',
    },
  ],
  ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5', key: 'wfsgrz' }],
  ['path', { d: 'M9 15h6', key: 'cctwl0' }],
  ['path', { d: 'M12 18v-6', key: '17g6i2' }],
] as const;
export const FilePlus = createIcon('file-plus', FilePlusNode);

const FileTextNode: IconNode = [
  [
    'path',
    {
      d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z',
      key: '1oefj6',
    },
  ],
  ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5', key: 'wfsgrz' }],
  ['path', { d: 'M10 9H8', key: 'b1mrlr' }],
  ['path', { d: 'M16 13H8', key: 't4e002' }],
  ['path', { d: 'M16 17H8', key: 'z1uh3a' }],
] as const;
export const FileText = createIcon('file-text', FileTextNode);

const FolderOpenNode: IconNode = [
  [
    'path',
    {
      d: 'm6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2',
      key: 'usdka0',
    },
  ],
] as const;
export const FolderOpen = createIcon('folder-open', FolderOpenNode);

const GitBranchNode: IconNode = [
  ['path', { d: 'M15 6a9 9 0 0 0-9 9V3', key: '1cii5b' }],
  ['circle', { cx: '18', cy: '6', r: '3', key: '1h7g24' }],
  ['circle', { cx: '6', cy: '18', r: '3', key: 'fqmcym' }],
] as const;
export const GitBranch = createIcon('git-branch', GitBranchNode);

const GitCommitNode: IconNode = [
  ['circle', { cx: '12', cy: '12', r: '3', key: '1v7zrd' }],
  ['line', { x1: '3', x2: '9', y1: '12', y2: '12', key: '1dyftd' }],
  ['line', { x1: '15', x2: '21', y1: '12', y2: '12', key: 'oup4p8' }],
] as const;
export const GitCommit = createIcon('git-commit-horizontal', GitCommitNode);

const GitPullRequestNode: IconNode = [
  ['circle', { cx: '18', cy: '18', r: '3', key: '1xkwt0' }],
  ['circle', { cx: '6', cy: '6', r: '3', key: '1lh9wr' }],
  ['path', { d: 'M13 6h3a2 2 0 0 1 2 2v7', key: '1yeb86' }],
  ['line', { x1: '6', x2: '6', y1: '9', y2: '21', key: 'rroup' }],
] as const;
export const GitPullRequest = createIcon('git-pull-request', GitPullRequestNode);

const GripVerticalNode: IconNode = [
  ['circle', { cx: '9', cy: '12', r: '1', key: '1vctgf' }],
  ['circle', { cx: '9', cy: '5', r: '1', key: 'hp0tcf' }],
  ['circle', { cx: '9', cy: '19', r: '1', key: 'fkjjf6' }],
  ['circle', { cx: '15', cy: '12', r: '1', key: '1tmaij' }],
  ['circle', { cx: '15', cy: '5', r: '1', key: '19l28e' }],
  ['circle', { cx: '15', cy: '19', r: '1', key: 'f4zoj3' }],
] as const;
export const GripVertical = createIcon('grip-vertical', GripVerticalNode);

const ImagePlusNode: IconNode = [
  ['path', { d: 'M16 5h6', key: '1vod17' }],
  ['path', { d: 'M19 2v6', key: '4bpg5p' }],
  ['path', { d: 'M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5', key: '1ue2ih' }],
  ['path', { d: 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21', key: '1xmnt7' }],
  ['circle', { cx: '9', cy: '9', r: '2', key: 'af1f0g' }],
] as const;
export const ImagePlus = createIcon('image-plus', ImagePlusNode);

const ImageNode: IconNode = [
  ['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2', ry: '2', key: '1m3agn' }],
  ['circle', { cx: '9', cy: '9', r: '2', key: 'af1f0g' }],
  ['path', { d: 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21', key: '1xmnt7' }],
] as const;
export const Image = createIcon('image', ImageNode);
export const ImageIcon = Image;

const InfoNode: IconNode = [
  ['circle', { cx: '12', cy: '12', r: '10', key: '1mglay' }],
  ['path', { d: 'M12 16v-4', key: '1dtifu' }],
  ['path', { d: 'M12 8h.01', key: 'e9boi3' }],
] as const;
export const Info = createIcon('info', InfoNode);

const LayersNode: IconNode = [
  [
    'path',
    {
      d: 'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z',
      key: 'zw3jo',
    },
  ],
  [
    'path',
    {
      d: 'M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12',
      key: '1wduqc',
    },
  ],
  [
    'path',
    {
      d: 'M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17',
      key: 'kqbvx6',
    },
  ],
] as const;
export const Layers = createIcon('layers', LayersNode);

const LayoutGridNode: IconNode = [
  ['rect', { width: '7', height: '7', x: '3', y: '3', rx: '1', key: '1g98yp' }],
  ['rect', { width: '7', height: '7', x: '14', y: '3', rx: '1', key: '6d4xhi' }],
  ['rect', { width: '7', height: '7', x: '14', y: '14', rx: '1', key: 'nxv5o0' }],
  ['rect', { width: '7', height: '7', x: '3', y: '14', rx: '1', key: '1bb6yr' }],
] as const;
export const LayoutGrid = createIcon('layout-grid', LayoutGridNode);

const LayoutListNode: IconNode = [
  ['rect', { width: '7', height: '7', x: '3', y: '3', rx: '1', key: '1g98yp' }],
  ['rect', { width: '7', height: '7', x: '3', y: '14', rx: '1', key: '1bb6yr' }],
  ['path', { d: 'M14 4h7', key: '3xa0d5' }],
  ['path', { d: 'M14 9h7', key: '1icrd9' }],
  ['path', { d: 'M14 15h7', key: '1mj8o2' }],
  ['path', { d: 'M14 20h7', key: '11slyb' }],
] as const;
export const LayoutList = createIcon('layout-list', LayoutListNode);

const Link2Node: IconNode = [
  ['path', { d: 'M9 17H7A5 5 0 0 1 7 7h2', key: '8i5ue5' }],
  ['path', { d: 'M15 7h2a5 5 0 1 1 0 10h-2', key: '1b9ql8' }],
  ['line', { x1: '8', x2: '16', y1: '12', y2: '12', key: '1jonct' }],
] as const;
export const Link2 = createIcon('link-2', Link2Node);

const ListNode: IconNode = [
  ['path', { d: 'M3 5h.01', key: '18ugdj' }],
  ['path', { d: 'M3 12h.01', key: 'nlz23k' }],
  ['path', { d: 'M3 19h.01', key: 'noohij' }],
  ['path', { d: 'M8 5h13', key: '1pao27' }],
  ['path', { d: 'M8 12h13', key: '1za7za' }],
  ['path', { d: 'M8 19h13', key: 'm83p4d' }],
] as const;
export const List = createIcon('list', ListNode);

const Loader2Node: IconNode = [['path', { d: 'M21 12a9 9 0 1 1-6.219-8.56', key: '13zald' }]] as const;
export const Loader2 = createIcon('loader-circle', Loader2Node);
export const LoaderCircle = Loader2;

const LockNode: IconNode = [
  ['rect', { width: '18', height: '11', x: '3', y: '11', rx: '2', ry: '2', key: '1w4ew1' }],
  ['path', { d: 'M7 11V7a5 5 0 0 1 10 0v4', key: 'fwvmzm' }],
] as const;
export const Lock = createIcon('lock', LockNode);

const LogInNode: IconNode = [
  ['path', { d: 'm10 17 5-5-5-5', key: '1bsop3' }],
  ['path', { d: 'M15 12H3', key: '6jk70r' }],
  ['path', { d: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4', key: 'u53s6r' }],
] as const;
export const LogIn = createIcon('log-in', LogInNode);

const MenuNode: IconNode = [
  ['path', { d: 'M4 5h16', key: '1tepv9' }],
  ['path', { d: 'M4 12h16', key: '1lakjw' }],
  ['path', { d: 'M4 19h16', key: '1djgab' }],
] as const;
export const Menu = createIcon('menu', MenuNode);

const MoonNode: IconNode = [
  [
    'path',
    {
      d: 'M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401',
      key: 'kfwtm',
    },
  ],
] as const;
export const Moon = createIcon('moon', MoonNode);

const OctagonXNode: IconNode = [
  ['path', { d: 'm15 9-6 6', key: '1uzhvr' }],
  [
    'path',
    {
      d: 'M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z',
      key: '2d38gg',
    },
  ],
  ['path', { d: 'm9 9 6 6', key: 'z0biqf' }],
] as const;
export const OctagonX = createIcon('octagon-x', OctagonXNode);

const PaperclipNode: IconNode = [
  [
    'path',
    {
      d: 'm16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551',
      key: '1miecu',
    },
  ],
] as const;
export const Paperclip = createIcon('paperclip', PaperclipNode);

const PencilNode: IconNode = [
  [
    'path',
    {
      d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
      key: '1a8usu',
    },
  ],
  ['path', { d: 'm15 5 4 4', key: '1mk7zo' }],
] as const;
export const Pencil = createIcon('pencil', PencilNode);

const PlusNode: IconNode = [
  ['path', { d: 'M5 12h14', key: '1ays0h' }],
  ['path', { d: 'M12 5v14', key: 's699le' }],
] as const;
export const Plus = createIcon('plus', PlusNode);

const PuzzleNode: IconNode = [
  [
    'path',
    {
      d: 'M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z',
      key: 'w46dr5',
    },
  ],
] as const;
export const Puzzle = createIcon('puzzle', PuzzleNode);

const RefreshCwNode: IconNode = [
  ['path', { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8', key: 'v9h5vc' }],
  ['path', { d: 'M21 3v5h-5', key: '1q7to0' }],
  ['path', { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16', key: '3uifl3' }],
  ['path', { d: 'M8 16H3v5', key: '1cv678' }],
] as const;
export const RefreshCw = createIcon('refresh-cw', RefreshCwNode);

const SearchNode: IconNode = [
  ['path', { d: 'm21 21-4.34-4.34', key: '14j7rj' }],
  ['circle', { cx: '11', cy: '11', r: '8', key: '4ej97u' }],
] as const;
export const Search = createIcon('search', SearchNode);

const SendNode: IconNode = [
  [
    'path',
    {
      d: 'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z',
      key: '1ffxy3',
    },
  ],
  ['path', { d: 'm21.854 2.147-10.94 10.939', key: '12cjpa' }],
] as const;
export const Send = createIcon('send', SendNode);

const ShieldAlertNode: IconNode = [
  [
    'path',
    {
      d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
      key: 'oel41y',
    },
  ],
  ['path', { d: 'M12 8v4', key: '1got3b' }],
  ['path', { d: 'M12 16h.01', key: '1drbdi' }],
] as const;
export const ShieldAlert = createIcon('shield-alert', ShieldAlertNode);

const ShieldCheckNode: IconNode = [
  [
    'path',
    {
      d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
      key: 'oel41y',
    },
  ],
  ['path', { d: 'm9 12 2 2 4-4', key: 'dzmm74' }],
] as const;
export const ShieldCheck = createIcon('shield-check', ShieldCheckNode);

const ShieldNode: IconNode = [
  [
    'path',
    {
      d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
      key: 'oel41y',
    },
  ],
] as const;
export const Shield = createIcon('shield', ShieldNode);

const SparklesNode: IconNode = [
  [
    'path',
    {
      d: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z',
      key: '1s2grr',
    },
  ],
  ['path', { d: 'M20 2v4', key: '1rf3ol' }],
  ['path', { d: 'M22 4h-4', key: 'gwowj6' }],
  ['circle', { cx: '4', cy: '20', r: '2', key: '6kqj1y' }],
] as const;
export const Sparkles = createIcon('sparkles', SparklesNode);

const StarNode: IconNode = [
  [
    'path',
    {
      d: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z',
      key: 'r04s7s',
    },
  ],
] as const;
export const Star = createIcon('star', StarNode);

const SunNode: IconNode = [
  ['circle', { cx: '12', cy: '12', r: '4', key: '4exip2' }],
  ['path', { d: 'M12 2v2', key: 'tus03m' }],
  ['path', { d: 'M12 20v2', key: '1lh1kg' }],
  ['path', { d: 'm4.93 4.93 1.41 1.41', key: '149t6j' }],
  ['path', { d: 'm17.66 17.66 1.41 1.41', key: 'ptbguv' }],
  ['path', { d: 'M2 12h2', key: '1t8f8n' }],
  ['path', { d: 'M20 12h2', key: '1q8mjw' }],
  ['path', { d: 'm6.34 17.66-1.41 1.41', key: '1m8zz5' }],
  ['path', { d: 'm19.07 4.93-1.41 1.41', key: '1shlcs' }],
] as const;
export const Sun = createIcon('sun', SunNode);

const TerminalNode: IconNode = [
  ['path', { d: 'M12 19h8', key: 'baeox8' }],
  ['path', { d: 'm4 17 6-6-6-6', key: '1yngyt' }],
] as const;
export const Terminal = createIcon('terminal', TerminalNode);

const Trash2Node: IconNode = [
  ['path', { d: 'M10 11v6', key: 'nco0om' }],
  ['path', { d: 'M14 11v6', key: 'outv1u' }],
  ['path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', key: 'miytrc' }],
  ['path', { d: 'M3 6h18', key: 'd0wm0j' }],
  ['path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', key: 'e791ji' }],
] as const;
export const Trash2 = createIcon('trash-2', Trash2Node);

const AlertTriangleNode: IconNode = [
  [
    'path',
    {
      d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
      key: 'wmoenq',
    },
  ],
  ['path', { d: 'M12 9v4', key: 'juzpu7' }],
  ['path', { d: 'M12 17h.01', key: 'p32p05' }],
] as const;
export const AlertTriangle = createIcon('triangle-alert', AlertTriangleNode);
export const TriangleAlert = AlertTriangle;

const UploadNode: IconNode = [
  ['path', { d: 'M12 3v12', key: '1x0j5s' }],
  ['path', { d: 'm17 8-5-5-5 5', key: '7q97r8' }],
  ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', key: 'ih7n3h' }],
] as const;
export const Upload = createIcon('upload', UploadNode);

const UserNode: IconNode = [
  ['path', { d: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', key: '975kel' }],
  ['circle', { cx: '12', cy: '7', r: '4', key: '17ys0d' }],
] as const;
export const User = createIcon('user', UserNode);

const VariableNode: IconNode = [
  ['path', { d: 'M8 21s-4-3-4-9 4-9 4-9', key: 'uto9ud' }],
  ['path', { d: 'M16 3s4 3 4 9-4 9-4 9', key: '4w2vsq' }],
  ['line', { x1: '15', x2: '9', y1: '9', y2: '15', key: 'f7djnv' }],
  ['line', { x1: '9', x2: '15', y1: '9', y2: '15', key: '1shsy8' }],
] as const;
export const Variable = createIcon('variable', VariableNode);

const WrenchNode: IconNode = [
  [
    'path',
    {
      d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z',
      key: '1ngwbx',
    },
  ],
] as const;
export const Wrench = createIcon('wrench', WrenchNode);

const XNode: IconNode = [
  ['path', { d: 'M18 6 6 18', key: '1bl5f8' }],
  ['path', { d: 'm6 6 12 12', key: 'd8bk6v' }],
] as const;
export const X = createIcon('x', XNode);

const ZapNode: IconNode = [
  [
    'path',
    {
      d: 'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z',
      key: '1xq2db',
    },
  ],
] as const;
export const Zap = createIcon('zap', ZapNode);
