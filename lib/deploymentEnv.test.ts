import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockIsProductionMode } = vi.hoisted(() => ({
  mockIsProductionMode: vi.fn(() => false),
}));

vi.mock('./githubContentMode', () => ({
  isProductionMode: () => mockIsProductionMode(),
}));

describe('deploymentEnv', () => {
  let getProductionEnvIssues: (typeof import('./deploymentEnv'))['getProductionEnvIssues'];
  let assertProductionEnvOrThrow: (typeof import('./deploymentEnv'))['assertProductionEnvOrThrow'];

  beforeAll(async () => {
    const mod = await import('./deploymentEnv');
    getProductionEnvIssues = mod.getProductionEnvIssues;
    assertProductionEnvOrThrow = mod.assertProductionEnvOrThrow;
  });

  beforeEach(() => {
    mockIsProductionMode.mockReturnValue(false);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CMS_SESSION_SECRET', 'secret');
    vi.stubEnv('NEXTAUTH_SECRET', undefined);
    vi.stubEnv('GITHUB_ID', 'id');
    vi.stubEnv('GITHUB_SECRET', 'ghsecret');
    vi.stubEnv('CMS_APP_URL', 'https://app.example.com');
    vi.stubEnv('NEXTAUTH_URL', undefined);
    vi.stubEnv('GITHUB_REPO_OWNER', undefined);
    vi.stubEnv('GITHUB_REPO_NAME', undefined);
    vi.stubEnv('CMS_FORCE_GITHUB_API', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns no issues in non-production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CMS_SESSION_SECRET', undefined);
    expect(getProductionEnvIssues()).toEqual([]);
  });

  it('requires CMS auth env vars in production when GitHub content mode is off', () => {
    mockIsProductionMode.mockReturnValue(false);
    vi.stubEnv('CMS_SESSION_SECRET', undefined);
    vi.stubEnv('NEXTAUTH_SECRET', undefined);
    vi.stubEnv('CMS_APP_URL', undefined);
    vi.stubEnv('NEXTAUTH_URL', undefined);
    expect(getProductionEnvIssues()).toEqual(expect.arrayContaining(['CMS_SESSION_SECRET', 'CMS_APP_URL']));
  });

  it('accepts legacy NEXTAUTH_* vars during transition', () => {
    mockIsProductionMode.mockReturnValue(false);
    vi.stubEnv('CMS_SESSION_SECRET', undefined);
    vi.stubEnv('NEXTAUTH_SECRET', 'legacy-secret');
    vi.stubEnv('CMS_APP_URL', undefined);
    vi.stubEnv('NEXTAUTH_URL', 'https://legacy.example.com');
    expect(getProductionEnvIssues()).toEqual([]);
  });

  it('requires repository env vars when isProductionMode is true', () => {
    mockIsProductionMode.mockReturnValue(true);
    expect(getProductionEnvIssues()).toEqual(expect.arrayContaining(['GITHUB_REPO_OWNER', 'GITHUB_REPO_NAME']));
  });

  it('does not list repo vars when isProductionMode is false and base vars are set', () => {
    mockIsProductionMode.mockReturnValue(false);
    expect(getProductionEnvIssues()).toEqual([]);
  });

  it('assertProductionEnvOrThrow lists missing names in the error message', () => {
    mockIsProductionMode.mockReturnValue(false);
    vi.stubEnv('GITHUB_SECRET', undefined);
    expect(() => assertProductionEnvOrThrow()).toThrow(/GITHUB_SECRET/);
    expect(() => assertProductionEnvOrThrow()).toThrow(/README\.md/);
  });
});
