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
  buildAdminLayoutTemplate,
  buildAdminPageTemplate,
  agentChatRouteTemplate,
  mediaRouteTemplate,
  searchRouteTemplate,
  octocmsAuthRouteTemplate,
  LEGACY_NEXT_AUTH_ROUTE_TEMPLATE,
  LEGACY_ADMIN_CATCH_ALL_TEMPLATES,
  LEGACY_ADMIN_ERROR_TEMPLATES,
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
    const layoutTemplate = buildAdminLayoutTemplate();
    const result = writeOrMigrate(path, layoutTemplate, LEGACY_ADMIN_LAYOUT_TEMPLATES);
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
    const pageTemplate = buildAdminPageTemplate();
    const result = writeOrMigrate(path, pageTemplate, LEGACY_ADMIN_CATCH_ALL_TEMPLATES);
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
    const result = writeOrMigrate(path, adminErrorTemplate, LEGACY_ADMIN_ERROR_TEMPLATES);
    const display = `${rel}/cms/error.tsx`;
    if (result === 'created') {
      log.step(`${display} — created`);
      allUpToDate = false;
    } else if (result === 'updated') {
      log.step(`${display} — updated (legacy → octocms/admin/error import)`);
      allUpToDate = false;
    } else if (result === 'unchanged') {
      log.success(`${display} — up to date`);
    } else {
      log.info(`${display} — present (skipped, customised)`);
    }
  }

  // 4. Root layout — ensure configInit is imported so public-page serverless functions
  //    initialise the OctoCMS config on cold start (not just admin routes).
  // Bare-specifier import resolves identically from `app/layout.tsx` and
  // `src/app/layout.tsx` thanks to the `withOctoCMS()` bundler alias.
  const rootLayoutCandidates: Array<{ path: string; importLine: string }> = [
    { path: join(projectRoot, 'src', 'app', 'layout.tsx'), importLine: rootLayoutConfigInitImport },
    { path: join(projectRoot, 'app', 'layout.tsx'), importLine: rootLayoutConfigInitImport },
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

  // 5. OctoCMS auth route at `/api/octocms/auth/[action]`.
  const authRouteFile = join(absRoot, 'api', 'octocms', 'auth', '[action]', 'route.ts');
  const authRel = `${rel}/api/octocms/auth/[action]/route.ts`;
  {
    const expected = octocmsAuthRouteTemplate();
    if (!existsSync(authRouteFile)) {
      mkdirSync(dirname(authRouteFile), { recursive: true });
      writeFileSync(authRouteFile, expected, 'utf8');
      log.step(`${authRel} — created`);
      allUpToDate = false;
    } else {
      const current = readFileSync(authRouteFile, 'utf8');
      if (current === expected) {
        log.success(`${authRel} — up to date`);
      } else {
        log.info(`${authRel} — present (skipped, not auto-rewritten)`);
      }
    }
  }

  // Legacy NextAuth route — log migration hint when still present.
  const legacyAuthRouteFile = join(absRoot, 'api', 'auth', '[...nextauth]', 'route.ts');
  const legacyAuthRel = `${rel}/api/auth/[...nextauth]/route.ts`;
  if (existsSync(legacyAuthRouteFile)) {
    const legacyContent = readFileSync(legacyAuthRouteFile, 'utf8');
    if (legacyContent === LEGACY_NEXT_AUTH_ROUTE_TEMPLATE) {
      log.info(
        `${legacyAuthRel} — legacy NextAuth route detected; delete after verifying ${authRel} works and update your GitHub App callback URL to /api/octocms/auth/callback`,
      );
    } else {
      log.info(`${legacyAuthRel} — legacy NextAuth route present (customised — migrate manually)`);
    }
  }

  // 6. Chat-agent SSE route at `/api/octocms/agent`.
  const chatRouteFile = join(absRoot, 'api', 'octocms', 'agent', 'route.ts');
  const chatRel = `${rel}/api/octocms/agent/route.ts`;
  {
    const expected = agentChatRouteTemplate();
    if (!existsSync(chatRouteFile)) {
      mkdirSync(dirname(chatRouteFile), { recursive: true });
      writeFileSync(chatRouteFile, expected, 'utf8');
      log.step(`${chatRel} — created`);
      allUpToDate = false;
    } else {
      const current = readFileSync(chatRouteFile, 'utf8');
      if (current === expected) {
        log.success(`${chatRel} — up to date`);
      } else {
        log.info(`${chatRel} — present (skipped, not auto-rewritten)`);
      }
    }
  }

  const legacyChatRouteFile = join(absRoot, 'api', 'agent', 'route.ts');
  if (existsSync(legacyChatRouteFile)) {
    log.info(`${rel}/api/agent/route.ts — legacy route detected; delete after verifying ${chatRel} works`);
  }

  // 7. Public search route at `/api/octocms/search`.
  const searchRouteFile = join(absRoot, 'api', 'octocms', 'search', 'route.ts');
  const searchRel = `${rel}/api/octocms/search/route.ts`;
  {
    const expected = searchRouteTemplate();
    if (!existsSync(searchRouteFile)) {
      mkdirSync(dirname(searchRouteFile), { recursive: true });
      writeFileSync(searchRouteFile, expected, 'utf8');
      log.step(`${searchRel} — created`);
      allUpToDate = false;
    } else {
      const current = readFileSync(searchRouteFile, 'utf8');
      if (current === expected) {
        log.success(`${searchRel} — up to date`);
      } else {
        log.info(`${searchRel} — present (skipped, not auto-rewritten)`);
      }
    }
  }

  const legacySearchRouteFile = join(absRoot, 'api', 'search', 'route.ts');
  if (existsSync(legacySearchRouteFile)) {
    log.info(`${rel}/api/search/route.ts — legacy route detected; delete after verifying ${searchRel} works`);
  }

  // 8. Chat-agent proposal accept/reject — server actions only.
  const mediaRouteRoots: Array<{ file: string; rel: string }> = [
    {
      file: join(projectRoot, 'src', 'app', 'media', '[...slug]', 'route.ts'),
      rel: 'src/app/media/[...slug]/route.ts',
    },
    { file: join(projectRoot, 'app', 'media', '[...slug]', 'route.ts'), rel: 'app/media/[...slug]/route.ts' },
  ];
  // Pick the existing tree (`src/app` vs `app`); fall back to top-level `app/`.
  const mediaRoot = mediaRouteRoots.find((r) => existsSync(join(r.file, '..', '..', '..', '..'))) ?? mediaRouteRoots[1];
  {
    const expected = mediaRouteTemplate();
    if (!existsSync(mediaRoot.file)) {
      mkdirSync(join(mediaRoot.file, '..'), { recursive: true });
      writeFileSync(mediaRoot.file, expected, 'utf8');
      log.step(`${mediaRoot.rel} — created`);
      allUpToDate = false;
    } else {
      const current = readFileSync(mediaRoot.file, 'utf8');
      if (current === expected) {
        log.success(`${mediaRoot.rel} — up to date`);
      } else {
        log.info(`${mediaRoot.rel} — present (skipped, not auto-rewritten)`);
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
