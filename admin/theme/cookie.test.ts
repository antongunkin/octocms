import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getThemeCookie } from './cookie';

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
  it('returns "dark" when no cookie is set', async () => {
    const result = await getThemeCookie();
    expect(result).toBe('dark');
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

  it('returns "dark" for an unknown cookie value', async () => {
    mockGet.mockReturnValue({ value: 'midnight' });
    const result = await getThemeCookie();
    expect(result).toBe('dark');
  });

  it('returns "dark" for an empty cookie value', async () => {
    mockGet.mockReturnValue({ value: '' });
    const result = await getThemeCookie();
    expect(result).toBe('dark');
  });
});
