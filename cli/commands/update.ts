/**
 * `octocms update` — Regenerate admin route files in the user app.
 *
 * The current routing model is a single catch-all (`cms/[[...path]]/page.tsx`)
 * that re-exports `AdminApp` from the `octocms/admin` barrel, plus
 * `cms/layout.tsx` and `cms/error.tsx`. Three thin re-export files total.
 *
 * Migrates one prior shape: the deep-import catch-all that re-exported from
 * `octocms/admin/AdminApp` directly. When the user-app file matches that
 * historical template byte-for-byte, it's overwritten with the new barrel
 * import; otherwise it's left alone.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { log } from '../lib/logger';
import {
  adminErrorTemplate,
  adminLayoutTemplate,
  adminPageTemplate,
  agentChatRouteTemplate,
  agentProposalRouteTemplate,
  LEGACY_ADMIN_CATCH_ALL_TEMPLATES,
  LEGACY_ADMIN_LAYOUT_TEMPLATES,
  rootLayoutConfigInitImport,
} from '../lib/templates';

/**
 * Detect which `app/` root the project uses, returning the absolute path
 * plus the display prefix used for log messages. Falls back to `app/` so
 * fresh repos still get something written.
 */
function pickAppRoot(projectRoot: string): { absRoot: string; rel: string } {
  const srcApp = join(projectRoot, 'src', 'app');
  const bareApp = join(projectRoot, 'app');
  if (existsSync(srcApp)) return { absRoot: srcApp, rel: 'src/app' };
  if (existsSync(bareApp)) return { absRoot: bareApp, rel: 'app' };
  return { absRoot: bareApp, rel: 'app' };
}

/**
 * Write a single file. Returns `'created'`, `'updated'` (matched a known
 * legacy template — overwritten), `'unchanged'`, or `'preserved'` (user
 * content differs from any known template — left alone).
 */
function writeOrMigrate(
  file: string,
  expected: string,
  legacyVersions: ReadonlyArray<string>,
): 'created' | 'updated' | 'unchanged' | 'preserved' {
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, expected, 'utf8');
    return 'created';
  }
  const current = readFileSync(file, 'utf8');
  if (current === expected) return 'unchanged';
  if (legacyVersions.includes(current)) {
    writeFileSync(file, expected, 'utf8');
    return 'updated';
  }
  return 'preserved';
}

export async function updateCommand(projectRoot: string): Promise<void> {
  log.header('Update admin routes');

  const { absRoot, rel } = pickAppRoot(projectRoot);
  log.info(`Using ${rel}/ as the Next.js root.`);

  let allUpToDate = true;

  // 1. layout.tsx
  {
    const path = join(absRoot, 'cms', 'layout.tsx');
    const result = writeOrMigrate(path, adminLayoutTemplate, LEGACY_ADMIN_LAYOUT_TEMPLATES);
    const display = `${rel}/cms/layout.tsx`;
    if (result === 'created') {
      log.step(`${display} — created`);
      allUpToDate = false;
    } else if (result === 'updated') {
      log.step(`${display} — updated (legacy → barrel import)`);
      allUpToDate = false;
    } else if (result === 'unchanged') {
      log.success(`${display} — up to date`);
    } else {
      log.info(`${display} — present (skipped, customised)`);
    }
  }

  // 2. [[...path]]/page.tsx
  {
    const path = join(absRoot, 'cms', '[[...path]]', 'page.tsx');
    const result = writeOrMigrate(path, adminPageTemplate, LEGACY_ADMIN_CATCH_ALL_TEMPLATES);
    const display = `${rel}/cms/[[...path]]/page.tsx`;
    if (result === 'created') {
      log.step(`${display} — created`);
      allUpToDate = false;
    } else if (result === 'updated') {
      log.step(`${display} — updated (legacy → barrel import)`);
      allUpToDate = false;
    } else if (result === 'unchanged') {
      log.success(`${display} — up to date`);
    } else {
      log.info(`${display} — present (skipped, customised)`);
    }
  }

  // 3. error.tsx
  {
    const path = join(absRoot, 'cms', 'error.tsx');
    const result = writeOrMigrate(path, adminErrorTemplate, []);
    const display = `${rel}/cms/error.tsx`;
    if (result === 'created') {
      log.step(`${display} — created`);
      allUpToDate = false;
    } else if (result === 'unchanged') {
      log.success(`${display} — up to date`);
    } else {
      log.info(`${display} — present (skipped, customised)`);
    }
  }

  // 4. Root layout — ensure configInit is imported so public-page serverless functions
  //    initialise the OctoCMS config on cold start (not just admin routes).
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
        const relPath = path.replace(projectRoot + '/', '');
        log.step(`${relPath} — added configInit import`);
        allUpToDate = false;
      }
      break;
    }
  }

  // 5. Chat-agent SSE route.
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
  const chatRoot = chatRouteRoots.find((r) => existsSync(join(r.file, '..', '..', '..', '..'))) ?? chatRouteRoots[1];
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

  // 6. Chat-agent proposal routes.
  const proposalRouteRoots: Array<{ baseDir: string; depth: number; rel: string }> = [
    {
      baseDir: join(projectRoot, 'src', 'app', 'api', 'agent', 'proposals'),
      depth: 6,
      rel: 'src/app/api/agent/proposals',
    },
    { baseDir: join(projectRoot, 'app', 'api', 'agent', 'proposals'), depth: 5, rel: 'app/api/agent/proposals' },
  ];
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
