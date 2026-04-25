/**
 * `octocms update` — Regenerate admin route files in `src/app/cms/`.
 *
 * Ensures the admin layout and catch-all page re-export files are up-to-date
 * with the latest OctoCMS version. Useful after upgrading `octocms`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { log } from '../lib/logger';
import {
  adminLayoutTemplate,
  adminPageTemplate,
  agentChatRouteTemplate,
  agentProposalRouteTemplate,
  rootLayoutConfigInitImport,
} from '../lib/templates';

type FileCheck = {
  path: string;
  displayPath: string;
  expected: string;
};

export async function updateCommand(projectRoot: string): Promise<void> {
  log.header('Update admin routes');

  const files: FileCheck[] = [
    {
      path: join(projectRoot, 'src', 'app', 'cms', 'layout.tsx'),
      displayPath: 'src/app/cms/layout.tsx',
      expected: adminLayoutTemplate,
    },
    {
      path: join(projectRoot, 'src', 'app', 'cms', '[[...path]]', 'page.tsx'),
      displayPath: 'src/app/cms/[[...path]]/page.tsx',
      expected: adminPageTemplate,
    },
  ];

  log.info('Checking admin route files...');

  let allUpToDate = true;

  for (const file of files) {
    if (!existsSync(file.path)) {
      mkdirSync(join(file.path, '..'), { recursive: true });
      writeFileSync(file.path, file.expected, 'utf8');
      log.success(`${file.displayPath} — created`);
      allUpToDate = false;
    } else {
      const current = readFileSync(file.path, 'utf8');
      if (current === file.expected) {
        log.success(`${file.displayPath} — up to date`);
      } else {
        writeFileSync(file.path, file.expected, 'utf8');
        log.step(`${file.displayPath} — updated`);
        allUpToDate = false;
      }
    }
  }

  // Root layout — ensure configInit is imported so public page serverless functions
  // initialize the OctoCMS config on cold start (not just admin routes).
  // Try both src/app/ and app/ layouts; patch whichever exists.
  const rootLayoutCandidates: Array<{ path: string; importLine: string }> = [
    {
      path: join(projectRoot, 'src', 'app', 'layout.tsx'),
      importLine: `import '../../cms/__generated__/configInit';\n`,
    },
    {
      path: join(projectRoot, 'app', 'layout.tsx'),
      importLine: rootLayoutConfigInitImport,
    },
  ];

  for (const { path, importLine } of rootLayoutCandidates) {
    if (existsSync(path)) {
      const existing = readFileSync(path, 'utf8');
      if (!existing.includes('configInit')) {
        writeFileSync(path, importLine + existing, 'utf8');
        const rel = path.replace(projectRoot + '/', '');
        log.step(`${rel} — added configInit import`);
        allUpToDate = false;
      }
      break;
    }
  }

  // Chat-agent SSE route — ensure `app/api/agent/route.ts` exists as a thin re-export.
  // Depth from the route file to project root:
  //   - bare `app/api/agent/route.ts`     → 4
  //   - `src/app/api/agent/route.ts`      → 5
  const chatRouteRoots: Array<{ file: string; depth: number; rel: string }> = [
    {
      file: join(projectRoot, 'src', 'app', 'api', 'agent', 'route.ts'),
      depth: 5,
      rel: 'src/app/api/agent/route.ts',
    },
    {
      file: join(projectRoot, 'app', 'api', 'agent', 'route.ts'),
      depth: 4,
      rel: 'app/api/agent/route.ts',
    },
  ];
  // Pick the first whose parent `app/` directory exists. Fall back to bare `app/`.
  const chatRoot =
    chatRouteRoots.find((r) => existsSync(join(r.file, '..', '..', '..', '..'))) ?? chatRouteRoots[1];
  {
    const expected = agentChatRouteTemplate({ depth: chatRoot.depth });
    if (!existsSync(chatRoot.file)) {
      mkdirSync(join(chatRoot.file, '..'), { recursive: true });
      writeFileSync(chatRoot.file, expected, 'utf8');
      log.step(`${chatRoot.rel} — created`);
      allUpToDate = false;
    } else {
      const current = readFileSync(chatRoot.file, 'utf8');
      if (current === expected) {
        log.success(`${chatRoot.rel} — up to date`);
      } else {
        log.info(`${chatRoot.rel} — present (skipped, not auto-rewritten)`);
      }
    }
  }

  // Chat-agent proposal routes — ensure both endpoints exist as thin re-exports.
  // We pick the first layout root that already has an `app/` directory inside it
  // and write to that, mirroring the convention used by the rest of the project.
  // Depth from `app/api/agent/proposals/<endpoint>/route.ts` to project root:
  //   - bare `app/...`    → 5
  //   - `src/app/...`     → 6
  const proposalRouteRoots: Array<{ baseDir: string; depth: number; rel: string }> = [
    {
      baseDir: join(projectRoot, 'src', 'app', 'api', 'agent', 'proposals'),
      depth: 6,
      rel: 'src/app/api/agent/proposals',
    },
    { baseDir: join(projectRoot, 'app', 'api', 'agent', 'proposals'), depth: 5, rel: 'app/api/agent/proposals' },
  ];
  // Pick the first whose parent `app/` directory exists. Fall back to bare `app/`.
  const root = proposalRouteRoots.find((r) => existsSync(join(r.baseDir, '..', '..', '..'))) ?? proposalRouteRoots[1];

  for (const endpoint of ['accept', 'reject'] as const) {
    const file = join(root.baseDir, endpoint, 'route.ts');
    const expected = agentProposalRouteTemplate({
      handlerExport: endpoint === 'accept' ? 'acceptProposalRoute' : 'rejectProposalRoute',
      depth: root.depth,
    });
    if (!existsSync(file)) {
      mkdirSync(join(file, '..'), { recursive: true });
      writeFileSync(file, expected, 'utf8');
      log.step(`${root.rel}/${endpoint}/route.ts — created`);
      allUpToDate = false;
    } else {
      const current = readFileSync(file, 'utf8');
      if (current === expected) {
        log.success(`${root.rel}/${endpoint}/route.ts — up to date`);
      } else {
        // Don't clobber: route file exists but differs (user may have customised).
        log.info(`${root.rel}/${endpoint}/route.ts — present (skipped, not auto-rewritten)`);
      }
    }
  }

  log.blank();
  if (allUpToDate) {
    log.info('Admin routes are current.');
  } else {
    log.info('Admin routes have been updated.');
  }
  log.blank();
}
