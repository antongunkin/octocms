import { describe, expect, it } from 'vitest';
import {
  adminLayoutTemplate,
  adminPageTemplate,
  demoPostJson,
  demoPostMarkdown,
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

  it('includes demo post collection', () => {
    const out = octoConfigTemplate({ projectName: 'Test', baseBranch: 'main' });
    expect(out).toContain('post: {');
    expect(out).toContain("format: 'string'");
    expect(out).toContain("format: 'slug'");
    expect(out).toContain("format: 'markdown'");
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
    expect(adminLayoutTemplate).toContain("import '../../../cms/__generated__/configInit'");
  });

  it('imports globals.css and mdxeditor styles', () => {
    expect(adminLayoutTemplate).toContain("import 'octocms/globals.css'");
    expect(adminLayoutTemplate).toContain("import '@mdxeditor/editor/style.css'");
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

describe('demoPostJson', () => {
  it('returns valid JSON with sys and fields', () => {
    const json = JSON.parse(demoPostJson('001'));
    expect(json.sys.id).toBe('001');
    expect(json.sys.type).toBe('post');
    expect(json.sys.status).toBe('merged');
    expect(json.fields.title).toBe('Hello World');
    expect(json.fields.slug).toBe('hello-world');
    expect(json.fields.publishedAt).toBeTruthy();
  });
});

describe('demoPostMarkdown', () => {
  it('contains welcome text', () => {
    expect(demoPostMarkdown).toContain('Hello World');
    expect(demoPostMarkdown).toContain('OctoCMS');
  });
});

describe('tsconfigPaths', () => {
  it('includes all required aliases', () => {
    const paths = tsconfigPaths();
    expect(paths['octocms/config']).toBeUndefined();
    expect(paths['octocms/*']).toEqual(['./octocms/*']);
    expect(paths['@/*']).toEqual(['./src/*']);
    expect(paths['cms/__generated__']).toEqual(['./cms/__generated__/index.ts']);
  });
});
