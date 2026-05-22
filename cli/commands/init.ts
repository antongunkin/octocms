/**
 * `octocms init` — Initialize OctoCMS in a Next.js project.
 *
 * Writes the full CMS config inline into `next.config.ts`, creates admin
 * route files, demo content, and updates `tsconfig.json` with required
 * path aliases.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import readline from 'readline';

import { version as CLI_VERSION } from '../../package.json';
import { fmt, log } from '../lib/logger';

import {
  adminErrorTemplate,
  buildAdminLayoutTemplate,
  buildAdminPageTemplate,
  agentChatRouteTemplate,
  mediaRouteTemplate,
  demoHelloPageJson,
  envLocalTemplate,
  generatedConfigInitTemplate,
  generatedSchemaShimTemplate,
  generatedContentDeclsTemplate,
  generatedEnumsTemplate,
  generatedIndexTemplate,
  generatedQueryTemplate,
  generatedTypesTemplate,
  helloPageTemplate,
  nextAuthRouteTemplate,
  nextConfigTemplate,
  octoConfigTemplate,
  schemaJsonTemplate,
  readmeTemplate,
  rootLayoutConfigInitImport,
  rootLayoutTemplate,
  tsconfigPaths,
} from '../lib/templates';

/**
 * Required (non-optional) peer dependencies of `octocms`, excluding
 * `next` / `react` / `react-dom` which any Next.js project already has.
 *
 * Keep in sync with `octocms/package.json` `peerDependencies` minus the
 * entries flagged `optional: true` in `peerDependenciesMeta`. The
 * `init.test.ts` `keeps REQUIRED_PEER_DEPS in sync` test enforces this.
 */
const REQUIRED_PEER_DEPS: readonly string[] = [
  '@mdxeditor/editor',
  '@radix-ui/react-avatar',
  '@radix-ui/react-dialog',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-label',
  '@radix-ui/react-select',
  '@radix-ui/react-slot',
  '@radix-ui/react-tabs',
  '@radix-ui/react-toast',
  '@tanstack/react-query',
  'clsx',
  'glob',
  'minisearch',
  'next-auth',
  'octokit',
  'react-markdown',
  'rehype-sanitize',
  'remark-gfm',
  'remark-mdx',
  'sharp',
  'slugify',
  'sonner',
  'zod',
];

export type InitOptions = {
  /** Accept all defaults without prompting. */
  yes?: boolean;
};

type InitAnswers = {
  projectName: string;
  baseBranch: string;
  usePointerBranch: boolean;
  pointerBranch: string;
};

async function prompt(rl: readline.Interface, question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  return new Promise((resolve) => {
    rl.question(`  ? ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

async function confirm(rl: readline.Interface, question: string, defaultYes = false): Promise<boolean> {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const answer = await prompt(rl, `${question} (${hint})`);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

async function gatherAnswers(options: InitOptions): Promise<InitAnswers> {
  if (options.yes) {
    return {
      projectName: 'My CMS',
      baseBranch: 'main',
      usePointerBranch: false,
      pointerBranch: '',
    };
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const projectName = await prompt(rl, 'Project name', 'My CMS');
    const baseBranch = await prompt(rl, 'Git base branch', 'main');
    const usePointerBranch = await confirm(rl, 'Use a separate published pointer branch?');
    let pointerBranch = '';
    if (usePointerBranch) {
      pointerBranch = await prompt(rl, 'Pointer branch name', 'cms/publish-pointer');
    }

    return { projectName, baseBranch, usePointerBranch, pointerBranch };
  } finally {
    rl.close();
  }
}

/** Detect the dev port from the project's package.json dev script. Defaults to 3000. */
function detectDevPort(projectRoot: string): number {
  try {
    const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const devScript = pkg.scripts?.dev ?? '';
    const match = /(?:-p|--port)[= ](\d+)/.exec(devScript);
    if (match) return parseInt(match[1], 10);
  } catch {
    // ignore
  }
  return 3000;
}

export async function initCommand(projectRoot: string, options: InitOptions = {}): Promise<void> {
  log.header('Initialize a new project');

  // Already initialized if cms/octocms.config.ts already exports configOctoCMS,
  // OR if the schema source-of-truth file already exists. Either is enough.
  const octoConfigPath = join(projectRoot, 'cms', 'octocms.config.ts');
  const schemaJsonPath = join(projectRoot, 'cms', 'schema.json');
  const octoConfigInitialized =
    existsSync(octoConfigPath) && /export\s+const\s+configOctoCMS/.test(readFileSync(octoConfigPath, 'utf8'));
  if (octoConfigInitialized || existsSync(schemaJsonPath)) {
    log.error('cms/ already contains an OctoCMS install — this project is already initialized.');
    log.info('Use `octocms update` to regenerate admin route files.');
    process.exitCode = 1;
    return;
  }
  const nextConfigPath = join(projectRoot, 'next.config.ts');

  if (!existsSync(join(projectRoot, 'package.json'))) {
    log.error('No package.json found — run this inside a Next.js project.');
    process.exitCode = 1;
    return;
  }

  const answers = await gatherAnswers(options);

  log.blank();
  log.info('Creating files...');

  // Admin route files — three thin re-exports. The package owns dispatch +
  // per-component Suspense + skeletons via the `octocms/admin` barrel.
  const cmsRouteDir = join(projectRoot, 'app', 'cms');
  mkdirSync(join(cmsRouteDir, '[[...path]]'), { recursive: true });

  writeFileSync(join(cmsRouteDir, 'layout.tsx'), buildAdminLayoutTemplate(), 'utf8');
  log.success('app/cms/layout.tsx');

  writeFileSync(join(cmsRouteDir, '[[...path]]', 'page.tsx'), buildAdminPageTemplate(), 'utf8');
  log.success('app/cms/[[...path]]/page.tsx');

  writeFileSync(join(cmsRouteDir, 'error.tsx'), adminErrorTemplate, 'utf8');
  log.success('app/cms/error.tsx');

  // Root layout — ensure configInit is imported so public page serverless functions
  // initialize the OctoCMS config on cold start (not just admin routes).
  const rootLayoutPath = join(projectRoot, 'app', 'layout.tsx');
  if (!existsSync(rootLayoutPath)) {
    writeFileSync(rootLayoutPath, rootLayoutTemplate, 'utf8');
    log.success('app/layout.tsx — created with configInit import');
  } else {
    const existing = readFileSync(rootLayoutPath, 'utf8');
    if (!existing.includes('configInit')) {
      writeFileSync(rootLayoutPath, rootLayoutConfigInitImport + existing, 'utf8');
      log.success('app/layout.tsx — added configInit import');
    } else {
      log.success('app/layout.tsx — configInit import already present');
    }
  }

  // NextAuth API route
  const authRouteDir = join(projectRoot, 'app', 'api', 'auth', '[...nextauth]');
  mkdirSync(authRouteDir, { recursive: true });
  writeFileSync(join(authRouteDir, 'route.ts'), nextAuthRouteTemplate, 'utf8');
  log.success('app/api/auth/[...nextauth]/route.ts');

  // Chat-agent routes — thin re-exports of handlers in `octocms/agent`.
  // The handlers are opt-in (the agent feature is gated by config + provider
  // key at runtime); shipping the routes by default costs nothing when the
  // agent is disabled — every endpoint 404s in that case.
  const chatRouteDir = join(projectRoot, 'app', 'api', 'agent');
  mkdirSync(chatRouteDir, { recursive: true });
  writeFileSync(join(chatRouteDir, 'route.ts'), agentChatRouteTemplate(), 'utf8');
  log.success('app/api/agent/route.ts');

  // Note: chat-agent proposal accept/reject are server actions
  // (`acceptProposalAction` / `rejectProposalAction` in
  // `octocms/admin/actions/agent.ts`), called directly from `useChatStream` —
  // no public endpoint files are scaffolded.

  // Media proxy route — thin re-export of `mediaRoute` from `octocms/admin/mediaRoute`.
  // Vercel's filesystem is immutable after build, so images committed from the
  // CMS UI never land in `public/media/` on the running instance — routing
  // them through a Route Handler lets the GitHub-API path serve them.
  const mediaRouteDir = join(projectRoot, 'app', 'media', '[...slug]');
  mkdirSync(mediaRouteDir, { recursive: true });
  writeFileSync(join(mediaRouteDir, 'route.ts'), mediaRouteTemplate(), 'utf8');
  log.success('app/media/[...slug]/route.ts');

  // Hello page demo route
  mkdirSync(join(projectRoot, 'app', 'hello'), { recursive: true });
  writeFileSync(join(projectRoot, 'app', 'hello', 'page.tsx'), helloPageTemplate, 'utf8');
  log.success('app/hello/page.tsx');

  // Demo content
  const contentDir = join(projectRoot, 'cms', 'content', 'helloPage');
  mkdirSync(contentDir, { recursive: true });
  writeFileSync(join(contentDir, 'helloPage-0000.json'), demoHelloPageJson(), 'utf8');
  log.success('cms/content/helloPage/helloPage-0000.json');

  // cms/__generated__/ — write static starter files (schema-accurate for helloPage demo)
  // These are valid immediately; re-run `npx octocms types:gen` after editing the schema.
  const generatedDir = join(projectRoot, 'cms', '__generated__');
  mkdirSync(generatedDir, { recursive: true });
  const generatedFiles: [string, string][] = [
    ['types.ts', generatedTypesTemplate],
    ['enums.ts', generatedEnumsTemplate],
    ['content.d.ts', generatedContentDeclsTemplate],
    ['index.ts', generatedIndexTemplate],
    ['query.ts', generatedQueryTemplate],
    ['configInit.ts', generatedConfigInitTemplate],
  ];
  for (const [name, content] of generatedFiles) {
    writeFileSync(join(generatedDir, name), content, 'utf8');
    log.success(`cms/__generated__/${name}`);
  }

  // Media directory
  mkdirSync(join(projectRoot, 'public', 'media'), { recursive: true });

  // Schema source of truth + literal-typed shim + thin TS binding.
  log.blank();
  log.info('Updating configuration...');
  mkdirSync(join(projectRoot, 'cms'), { recursive: true });
  const schemaOpts = {
    projectName: answers.projectName,
    baseBranch: answers.baseBranch,
    pointerBranch: answers.usePointerBranch ? answers.pointerBranch : undefined,
  };
  // cms/schema.json — source of truth (Content Model UI reads/writes here).
  writeFileSync(join(projectRoot, 'cms', 'schema.json'), schemaJsonTemplate(schemaOpts), 'utf8');
  log.success('cms/schema.json — source of truth');
  // cms/__generated__/schema.ts — literal-typed mirror used by `query()`.
  writeFileSync(join(generatedDir, 'schema.ts'), generatedSchemaShimTemplate(schemaOpts), 'utf8');
  log.success('cms/__generated__/schema.ts');
  // cms/octocms.config.ts — thin TS binding that re-exports the generated shim.
  writeFileSync(octoConfigPath, octoConfigTemplate(schemaOpts), 'utf8');
  log.success('cms/octocms.config.ts — schema binding');

  // next.config.ts — write the thin Next.js wrapper
  writeFileSync(nextConfigPath, nextConfigTemplate(), 'utf8');
  log.success('next.config.ts — Next.js wrapper');

  // tsconfig.json
  const tsconfigPath = join(projectRoot, 'tsconfig.json');
  if (existsSync(tsconfigPath)) {
    try {
      const raw = readFileSync(tsconfigPath, 'utf8');
      const tsconfig = JSON.parse(raw);
      if (!tsconfig.compilerOptions) tsconfig.compilerOptions = {};
      if (!tsconfig.compilerOptions.paths) tsconfig.compilerOptions.paths = {};
      const requiredPaths = tsconfigPaths();
      let changed = false;
      for (const [alias, targets] of Object.entries(requiredPaths)) {
        if (!tsconfig.compilerOptions.paths[alias]) {
          tsconfig.compilerOptions.paths[alias] = targets;
          changed = true;
        }
      }
      if (changed) {
        writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n', 'utf8');
        log.success('tsconfig.json — added path aliases');
      } else {
        log.success('tsconfig.json — path aliases already present');
      }
    } catch {
      log.warn('tsconfig.json — could not parse; add path aliases manually');
    }
  } else {
    log.warn('tsconfig.json not found — create one with the required path aliases');
  }

  // .env.local — write stub only if it doesn't already exist
  const envLocalPath = join(projectRoot, '.env.local');
  if (!existsSync(envLocalPath)) {
    writeFileSync(envLocalPath, envLocalTemplate(), 'utf8');
    log.success('.env.local — environment variable stubs');
  } else {
    log.success('.env.local — already exists, skipped');
  }

  // README.md — write only if it doesn't already exist
  const readmePath = join(projectRoot, 'README.md');
  if (!existsSync(readmePath)) {
    writeFileSync(readmePath, readmeTemplate(answers.projectName), 'utf8');
    log.success('README.md — setup guide');
  } else {
    log.success('README.md — already exists, skipped');
  }

  const port = detectDevPort(projectRoot);
  log.blank();
  log.info('Next steps:');
  log.info('  1. Install dependencies:');
  log.info(`     ${fmt.cyan(`npm install octocms@${CLI_VERSION} ${REQUIRED_PEER_DEPS.join(' ')}`)}`);
  log.info('  2. Fill in GitHub App credentials in .env.local (see README.md)');
  log.info('  3. Run: npm run dev');
  log.info(`  4. Visit demo page: http://localhost:${port}/hello`);
  log.info(`  5. Visit CMS admin:  http://localhost:${port}/cms`);
  log.info('');
  log.info('  After editing cms/octocms.config.ts, regenerate types:');
  log.info('  npx octocms types:gen');
  log.blank();
}
