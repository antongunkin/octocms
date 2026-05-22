import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
  it('supports conditional strings', () => {
    const enabled = true;
    const disabled = false;
    expect(cn('text', enabled && 'test2')).toBe('text test2');
    expect(cn('text', disabled && 'test2')).toBe('text');
  });

  it('flattens nested arrays', () => {
    expect(cn('a', ['b', ['c', false], null])).toBe('a b c');
  });

  it('supports object syntax', () => {
    expect(cn('base', { active: true, hidden: false, disabled: 0, visible: 1 })).toBe('base active visible');
  });

  it('ignores empty values', () => {
    expect(cn('', 0, false, null, undefined, 'ok')).toBe('ok');
  });
});
