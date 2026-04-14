import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getThemeCookie } from './getThemeCookie';

const mockGet = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mockGet,
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockReturnValue(undefined);
});

describe('getThemeCookie', () => {
  it('returns "system" when no cookie is set', async () => {
    mockGet.mockReturnValue(undefined);
    const result = await getThemeCookie();
    expect(result).toBe('system');
  });

  it('returns "dark" when cookie value is "dark"', async () => {
    mockGet.mockReturnValue({ value: 'dark' });
    const result = await getThemeCookie();
    expect(result).toBe('dark');
  });

  it('returns "light" when cookie value is "light"', async () => {
    mockGet.mockReturnValue({ value: 'light' });
    const result = await getThemeCookie();
    expect(result).toBe('light');
  });

  it('returns "system" when cookie value is "system"', async () => {
    mockGet.mockReturnValue({ value: 'system' });
    const result = await getThemeCookie();
    expect(result).toBe('system');
  });

  it('returns "system" for an unknown cookie value', async () => {
    mockGet.mockReturnValue({ value: 'midnight' });
    const result = await getThemeCookie();
    expect(result).toBe('system');
  });

  it('returns "system" for an empty cookie value', async () => {
    mockGet.mockReturnValue({ value: '' });
    const result = await getThemeCookie();
    expect(result).toBe('system');
  });
});
