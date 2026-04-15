import { describe, expect, it } from 'vitest';
import {
  adminLayoutTemplate,
  adminPageTemplate,
  demoHelloPageJson,
  helloPageTemplate,
  nextConfigTemplate,
  octoConfigTemplate,
  tsconfigPaths,
} from './templates';

describe('octoConfigTemplate', () => {
  it('imports defineConfig from octocms/config and Config from octocms/types', () => {
    const out = octoConfigTemplate({ projectName: 'Test', baseBranch: 'main' });
    expect(out).toContain("import { defineConfig } from 'octocms/config'");
    expect(out).toContain("import type { Config } from 'octocms/types'");
  });

  it('uses _typedConfigOctoCMS and configOctoCMS variable names', () => {
    const out = octoConfigTemplate({ projectName: 'Test', baseBranch: 'main' });
    expect(out).toContain('const _typedConfigOctoCMS = defineConfig(');
    expect(out).toContain('export const configOctoCMS: Config = _typedConfigOctoCMS');
    expect(out).toContain('export type OctoConfig = typeof _typedConfigOctoCMS');
  });

  it('generates config with project name', () => {
    const out = octoConfigTemplate({
      projectName: 'My Site',
      baseBranch: 'main',
    });
    expect(out).toContain("projectName: 'My Site'");
  });

  it('generates config with base branch', () => {
    const out = octoConfigTemplate({
      projectName: 'Test',
      baseBranch: 'develop',
    });
    expect(out).toContain("baseBranch: 'develop'");
  });

  it('includes pointer branch when provided', () => {
    const out = octoConfigTemplate({
      projectName: 'Test',
      baseBranch: 'main',
      pointerBranch: 'cms/publish-pointer',
    });
    expect(out).toContain("publishedPointerBranch: 'cms/publish-pointer'");
  });

  it('omits pointer branch when not provided', () => {
    const out = octoConfigTemplate({ projectName: 'Test', baseBranch: 'main' });
    expect(out).not.toContain('publishedPointerBranch');
  });

  it('includes helloPage singleton collection', () => {
    const out = octoConfigTemplate({ projectName: 'Test', baseBranch: 'main' });
    expect(out).toContain('helloPage: {');
    expect(out).toContain("format: 'string'");
    expect(out).toContain("format: 'text'");
  });
});

describe('nextConfigTemplate', () => {
  it('imports withOctoCMS from octocms/config', () => {
    const out = nextConfigTemplate();
    expect(out).toContain("import { withOctoCMS } from 'octocms/config'");
  });

  it('imports configOctoCMS from cms/octocms.config', () => {
    const out = nextConfigTemplate();
    expect(out).toContain("import { configOctoCMS } from './cms/octocms.config'");
  });

  it('re-exports configOctoCMS and OctoConfig', () => {
    const out = nextConfigTemplate();
    expect(out).toContain("export { configOctoCMS } from './cms/octocms.config'");
    expect(out).toContain("export type { OctoConfig } from './cms/octocms.config'");
  });

  it('exports withOctoCMS as default', () => {
    const out = nextConfigTemplate();
    expect(out).toContain('export default withOctoCMS(nextConfig, configOctoCMS)');
  });

  it('does not contain defineConfig', () => {
    const out = nextConfigTemplate();
    expect(out).not.toContain('defineConfig');
  });
});

describe('adminLayoutTemplate', () => {
  it('imports configInit for cold-start config hydration', () => {
    expect(adminLayoutTemplate).toContain("import '../../cms/__generated__/configInit'");
  });

  it('does not duplicate CSS imports (AdminLayout.tsx source handles them)', () => {
    expect(adminLayoutTemplate).not.toContain("import 'octocms/globals.css'");
    expect(adminLayoutTemplate).not.toContain("import '@mdxeditor/editor/style.css'");
  });

  it('re-exports AdminLayout', () => {
    expect(adminLayoutTemplate).toContain("from 'octocms/admin/pages/AdminLayout'");
  });
});

describe('adminPageTemplate', () => {
  it('re-exports AdminApp', () => {
    expect(adminPageTemplate).toContain("from 'octocms/admin/AdminApp'");
  });
});

describe('demoHelloPageJson', () => {
  it('returns valid JSON with sys and fields', () => {
    const json = JSON.parse(demoHelloPageJson());
    expect(json.sys.id).toBe('0000');
    expect(json.sys.type).toBe('helloPage');
    expect(json.sys.status).toBe('merged');
    expect(json.fields.title).toBe('Hello World');
    expect(json.fields.description).toBeTruthy();
  });
});

describe('helloPageTemplate', () => {
  it('imports query from cms/__generated__/query', () => {
    expect(helloPageTemplate).toContain("from 'cms/__generated__/query'");
  });

  it('queries helloPage collection', () => {
    expect(helloPageTemplate).toContain("query('helloPage').first()");
  });
});

describe('tsconfigPaths', () => {
  it('includes required aliases', () => {
    const paths = tsconfigPaths();
    expect(paths['@/*']).toEqual(['./src/*']);
    expect(paths['cms/__generated__']).toEqual(['./cms/__generated__/index.ts']);
    expect(paths['cms/__generated__/*']).toEqual(['./cms/__generated__/*']);
  });

  it('does not include octocms/* alias (resolved via node_modules when installed as npm package)', () => {
    const paths = tsconfigPaths();
    expect(paths['octocms/*']).toBeUndefined();
  });
});
