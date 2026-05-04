import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getBuildId,
  getCmsBranchEnv,
  getPointerFilePath,
  isDefaultPublicEditorBranch,
  serializePointerPayload,
} from './contentBranch';

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.CMS_BRANCH;
  delete process.env.VERCEL_DEPLOYMENT_ID;
  delete process.env.VERCEL_BUILD_ID;
  delete process.env.GITHUB_RUN_ID;
  delete process.env.BUILD_ID;
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe('getCmsBranchEnv', () => {
  it('returns undefined when unset', () => {
    expect(getCmsBranchEnv()).toBeUndefined();
  });

  it('returns trimmed value when set', () => {
    process.env.CMS_BRANCH = '  staging  ';
    expect(getCmsBranchEnv()).toBe('staging');
  });
});

describe('getBuildId', () => {
  it('prefers VERCEL_DEPLOYMENT_ID', () => {
    process.env.VERCEL_DEPLOYMENT_ID = 'dpl_abc';
    expect(getBuildId()).toBe('dpl_abc');
  });

  it('falls back to VERCEL_BUILD_ID', () => {
    process.env.VERCEL_BUILD_ID = 'build_xyz';
    expect(getBuildId()).toBe('build_xyz');
  });

  it('falls back to GITHUB_RUN_ID', () => {
    process.env.GITHUB_RUN_ID = '12345';
    expect(getBuildId()).toBe('12345');
  });

  it('falls back to BUILD_ID', () => {
    process.env.BUILD_ID = 'ci-99';
    expect(getBuildId()).toBe('ci-99');
  });

  it('returns local when nothing set', () => {
    expect(getBuildId()).toBe('local');
  });
});

describe('isDefaultPublicEditorBranch', () => {
  it('treats base branch as default', () => {
    expect(isDefaultPublicEditorBranch('main', 'main')).toBe(true);
  });

  it('treats CMS_BRANCH as default when set', () => {
    process.env.CMS_BRANCH = 'develop';
    expect(isDefaultPublicEditorBranch('develop', 'main')).toBe(true);
    expect(isDefaultPublicEditorBranch('cms/edit-x', 'main')).toBe(false);
  });
});

describe('getPointerFilePath', () => {
  it('uses build id in filename', () => {
    process.env.BUILD_ID = 'b1';
    expect(getPointerFilePath()).toBe('cms/pointers/b1.json');
  });
});

describe('serializePointerPayload', () => {
  it('includes branch and buildId', () => {
    process.env.BUILD_ID = 'bid-1';
    const s = serializePointerPayload('cms/edit-x');
    expect(JSON.parse(s)).toEqual({ branch: 'cms/edit-x', buildId: 'bid-1' });
  });
});
