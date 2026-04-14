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

import { log } from '../lib/logger';
import {
  adminLayoutTemplate,
  adminPageTemplate,
  demoHelloPageJson,
  envLocalTemplate,
  helloPageTemplate,
  nextConfigTemplate,
  octoConfigTemplate,
  readmeTemplate,
  tsconfigPaths,
} from '../lib/templates';

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

  // Already initialized if cms/octocms.config.ts already contains defineConfig
  const octoConfigPath = join(projectRoot, 'cms', 'octocms.config.ts');
  if (existsSync(octoConfigPath) && readFileSync(octoConfigPath, 'utf8').includes('defineConfig')) {
    log.error('cms/octocms.config.ts already contains defineConfig — this project is already initialized.');
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

  // Admin route files
  const cmsRouteDir = join(projectRoot, 'app', 'cms');
  mkdirSync(join(cmsRouteDir, '[[...path]]'), { recursive: true });

  writeFileSync(join(cmsRouteDir, 'layout.tsx'), adminLayoutTemplate, 'utf8');
  log.success('app/cms/layout.tsx');

  writeFileSync(join(cmsRouteDir, '[[...path]]', 'page.tsx'), adminPageTemplate, 'utf8');
  log.success('app/cms/[[...path]]/page.tsx');

  // Hello page demo route
  mkdirSync(join(projectRoot, 'app', 'hello'), { recursive: true });
  writeFileSync(join(projectRoot, 'app', 'hello', 'page.tsx'), helloPageTemplate, 'utf8');
  log.success('app/hello/page.tsx');

  // Demo content
  const contentDir = join(projectRoot, 'cms', 'content', 'helloPage');
  mkdirSync(contentDir, { recursive: true });
  writeFileSync(join(contentDir, 'helloPage-0000.json'), demoHelloPageJson(), 'utf8');
  log.success('cms/content/helloPage/helloPage-0000.json');

  // Generated types directory
  mkdirSync(join(projectRoot, 'cms', '__generated__'), { recursive: true });

  // Media directory
  mkdirSync(join(projectRoot, 'public', 'media'), { recursive: true });

  // cms/octocms.config.ts — write the OctoCMS schema
  log.blank();
  log.info('Updating configuration...');
  mkdirSync(join(projectRoot, 'cms'), { recursive: true });
  writeFileSync(
    octoConfigPath,
    octoConfigTemplate({
      projectName: answers.projectName,
      baseBranch: answers.baseBranch,
      pointerBranch: answers.usePointerBranch ? answers.pointerBranch : undefined,
    }),
    'utf8',
  );
  log.success('cms/octocms.config.ts — OctoCMS schema');

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

  // Generate types (best-effort — may fail if octocms is not yet installed)
  log.blank();
  log.info('Generating types...');
  try {
    const { typesGenCommand } = await import('./typesGen');
    await typesGenCommand(projectRoot);
  } catch (e) {
    log.warn(`Type generation failed: ${String((e as Error).message)}`);
    log.warn('Run `npx octocms types:gen` after installing dependencies.');
  }

  const port = detectDevPort(projectRoot);
  log.info('Next steps:');
  log.info('  1. Fill in GitHub App credentials in .env.local (see README.md)');
  log.info('  2. Run: npm run dev');
  log.info(`  3. Visit demo page: http://localhost:${port}/hello`);
  log.info(`  4. Visit CMS admin:  http://localhost:${port}/cms`);
  log.blank();
}
