import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { updateCommand } from './update';
import {
  adminErrorTemplate,
  buildAdminLayoutTemplate,
  buildAdminPageTemplate,
  LEGACY_ADMIN_CATCH_ALL_TEMPLATES,
  LEGACY_ADMIN_LAYOUT_TEMPLATES,
  octocmsAuthRouteTemplate,
} from '../lib/templates';

const expectedAdminPage = buildAdminPageTemplate();
const expectedAdminLayout = buildAdminLayoutTemplate();

const TMP_DIR = join(process.cwd(), '.tmp-update-test');

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('updateCommand — 3-file model', () => {
  it('creates the catch-all + layout + error.tsx in src/app/cms/', async () => {
    mkdirSync(join(TMP_DIR, 'src', 'app'), { recursive: true });
    await updateCommand(TMP_DIR);
    const cmsDir = join(TMP_DIR, 'src', 'app', 'cms');
    expect(readFileSync(join(cmsDir, 'layout.tsx'), 'utf8')).toBe(expectedAdminLayout);
    expect(readFileSync(join(cmsDir, '[[...path]]', 'page.tsx'), 'utf8')).toBe(expectedAdminPage);
    expect(readFileSync(join(cmsDir, 'error.tsx'), 'utf8')).toBe(adminErrorTemplate);
  });

  it('does not modify up-to-date files', async () => {
    const cmsDir = join(TMP_DIR, 'src', 'app', 'cms');
    mkdirSync(join(cmsDir, '[[...path]]'), { recursive: true });
    writeFileSync(join(cmsDir, 'layout.tsx'), expectedAdminLayout, 'utf8');
    writeFileSync(join(cmsDir, '[[...path]]', 'page.tsx'), expectedAdminPage, 'utf8');
    writeFileSync(join(cmsDir, 'error.tsx'), adminErrorTemplate, 'utf8');

    await updateCommand(TMP_DIR);

    expect(readFileSync(join(cmsDir, 'layout.tsx'), 'utf8')).toBe(expectedAdminLayout);
    expect(readFileSync(join(cmsDir, '[[...path]]', 'page.tsx'), 'utf8')).toBe(expectedAdminPage);
    expect(readFileSync(join(cmsDir, 'error.tsx'), 'utf8')).toBe(adminErrorTemplate);
  });

  it('preserves customised admin route files instead of overwriting', async () => {
    const cmsDir = join(TMP_DIR, 'src', 'app', 'cms');
    mkdirSync(join(cmsDir, '[[...path]]'), { recursive: true });
    const customPage = '// my custom catch-all\nexport default function Page() { return null; }\n';
    writeFileSync(join(cmsDir, '[[...path]]', 'page.tsx'), customPage, 'utf8');
    await updateCommand(TMP_DIR);
    expect(readFileSync(join(cmsDir, '[[...path]]', 'page.tsx'), 'utf8')).toBe(customPage);
    // layout + error.tsx should still get created.
    expect(existsSync(join(cmsDir, 'layout.tsx'))).toBe(true);
    expect(existsSync(join(cmsDir, 'error.tsx'))).toBe(true);
  });
});

describe('updateCommand — legacy catch-all migration (deep import → barrel)', () => {
  it('overwrites a legacy catch-all that matches a known historical template', async () => {
    const cmsDir = join(TMP_DIR, 'src', 'app', 'cms');
    mkdirSync(join(cmsDir, '[[...path]]'), { recursive: true });
    writeFileSync(join(cmsDir, '[[...path]]', 'page.tsx'), LEGACY_ADMIN_CATCH_ALL_TEMPLATES[0], 'utf8');
    writeFileSync(join(cmsDir, 'layout.tsx'), LEGACY_ADMIN_LAYOUT_TEMPLATES[0], 'utf8');

    await updateCommand(TMP_DIR);

    expect(readFileSync(join(cmsDir, '[[...path]]', 'page.tsx'), 'utf8')).toBe(expectedAdminPage);
    expect(readFileSync(join(cmsDir, 'layout.tsx'), 'utf8')).toBe(expectedAdminLayout);
  });

  it('migrates barrel catch-all without page configInit to the current template', async () => {
    const cmsDir = join(TMP_DIR, 'src', 'app', 'cms');
    mkdirSync(join(cmsDir, '[[...path]]'), { recursive: true });
    writeFileSync(join(cmsDir, '[[...path]]', 'page.tsx'), LEGACY_ADMIN_CATCH_ALL_TEMPLATES[1], 'utf8');

    await updateCommand(TMP_DIR);

    expect(readFileSync(join(cmsDir, '[[...path]]', 'page.tsx'), 'utf8')).toBe(expectedAdminPage);
  });
});

describe('updateCommand — octocms auth route', () => {
  it('creates src/app/api/octocms/auth/[action]/route.ts when missing', async () => {
    mkdirSync(join(TMP_DIR, 'src', 'app'), { recursive: true });
    await updateCommand(TMP_DIR);
    const authFile = join(TMP_DIR, 'src', 'app', 'api', 'octocms', 'auth', '[action]', 'route.ts');
    expect(existsSync(authFile)).toBe(true);
    expect(readFileSync(authFile, 'utf8')).toBe(octocmsAuthRouteTemplate());
  });

  it('preserves a customised octocms auth route instead of overwriting', async () => {
    const authDir = join(TMP_DIR, 'src', 'app', 'api', 'octocms', 'auth', '[action]');
    mkdirSync(authDir, { recursive: true });
    const customised = '// custom auth setup with authorizeUser hook\nexport {};\n';
    writeFileSync(join(authDir, 'route.ts'), customised, 'utf8');
    await updateCommand(TMP_DIR);
    expect(readFileSync(join(authDir, 'route.ts'), 'utf8')).toBe(customised);
  });
});

describe('updateCommand — idempotency', () => {
  it('is a no-op on an already-migrated tree', async () => {
    mkdirSync(join(TMP_DIR, 'src', 'app'), { recursive: true });
    await updateCommand(TMP_DIR);
    const cmsDir = join(TMP_DIR, 'src', 'app', 'cms');
    const before = {
      layout: readFileSync(join(cmsDir, 'layout.tsx'), 'utf8'),
      page: readFileSync(join(cmsDir, '[[...path]]', 'page.tsx'), 'utf8'),
      error: readFileSync(join(cmsDir, 'error.tsx'), 'utf8'),
    };
    await updateCommand(TMP_DIR);
    expect(readFileSync(join(cmsDir, 'layout.tsx'), 'utf8')).toBe(before.layout);
    expect(readFileSync(join(cmsDir, '[[...path]]', 'page.tsx'), 'utf8')).toBe(before.page);
    expect(readFileSync(join(cmsDir, 'error.tsx'), 'utf8')).toBe(before.error);
  });
});
