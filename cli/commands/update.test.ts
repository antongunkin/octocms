import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { updateCommand } from './update';
import { adminLayoutTemplate, adminPageTemplate } from '../lib/templates';

const TMP_DIR = join(process.cwd(), '.tmp-update-test');

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('updateCommand', () => {
  it('creates missing admin files', async () => {
    await updateCommand(TMP_DIR);
    expect(existsSync(join(TMP_DIR, 'src', 'app', 'cms', 'layout.tsx'))).toBe(true);
    expect(existsSync(join(TMP_DIR, 'src', 'app', 'cms', '[[...path]]', 'page.tsx'))).toBe(true);
  });

  it('created files match expected templates', async () => {
    await updateCommand(TMP_DIR);
    const layout = readFileSync(join(TMP_DIR, 'src', 'app', 'cms', 'layout.tsx'), 'utf8');
    const page = readFileSync(join(TMP_DIR, 'src', 'app', 'cms', '[[...path]]', 'page.tsx'), 'utf8');
    expect(layout).toBe(adminLayoutTemplate);
    expect(page).toBe(adminPageTemplate);
  });

  it('does not overwrite up-to-date files', async () => {
    // Create the files first
    const cmsDir = join(TMP_DIR, 'src', 'app', 'cms');
    mkdirSync(join(cmsDir, '[[...path]]'), { recursive: true });
    writeFileSync(join(cmsDir, 'layout.tsx'), adminLayoutTemplate, 'utf8');
    writeFileSync(join(cmsDir, '[[...path]]', 'page.tsx'), adminPageTemplate, 'utf8');

    // Run update — should report "up to date"
    await updateCommand(TMP_DIR);

    // Files should still match
    const layout = readFileSync(join(cmsDir, 'layout.tsx'), 'utf8');
    expect(layout).toBe(adminLayoutTemplate);
  });

  it('updates outdated files', async () => {
    const cmsDir = join(TMP_DIR, 'src', 'app', 'cms');
    mkdirSync(join(cmsDir, '[[...path]]'), { recursive: true });
    writeFileSync(join(cmsDir, 'layout.tsx'), 'old content', 'utf8');

    await updateCommand(TMP_DIR);

    const layout = readFileSync(join(cmsDir, 'layout.tsx'), 'utf8');
    expect(layout).toBe(adminLayoutTemplate);
  });
});
