import { describe, expect, it } from 'vitest';

import type { ConditionalCollectionField } from '../admin/types';

import {
  getBranchConfig,
  getInlineBranchFields,
  isReferenceBranch,
  parseConditionalFieldValue,
  validateConditionalConfig,
} from './conditionalField';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const inlineField: ConditionalCollectionField = {
  format: 'conditional',
  label: 'Hero',
  conditional: {
    branches: [
      {
        key: 'image',
        label: 'Image Hero',
        fields: {
          src: { format: 'image', label: 'Image' },
          alt: { format: 'string', label: 'Alt' },
        },
      },
      {
        key: 'text',
        label: 'Text Hero',
        fields: {
          headline: { format: 'string', label: 'Headline', required: true },
        },
      },
    ],
  },
};

const mixedField: ConditionalCollectionField = {
  format: 'conditional',
  label: 'Featured',
  conditional: {
    branches: [
      {
        key: 'inline',
        label: 'Inline',
        fields: { title: { format: 'string', label: 'Title' } },
      },
      {
        key: 'ref',
        label: 'Reference',
        collection: 'post' as any,
      },
    ],
  },
};

const requiredField: ConditionalCollectionField = {
  ...inlineField,
  required: true,
};

// ---------------------------------------------------------------------------
// parseConditionalFieldValue
// ---------------------------------------------------------------------------

describe('parseConditionalFieldValue', () => {
  it('parses a valid keyed object', () => {
    const result = parseConditionalFieldValue(inlineField, {
      image: { src: 'uuid-1', alt: 'photo' },
      text: { headline: 'Hello' },
    });
    expect(result).toEqual({
      ok: true,
      value: {
        image: { src: 'uuid-1', alt: 'photo' },
        text: { headline: 'Hello' },
      },
    });
  });

  it('parses a JSON string', () => {
    const raw = JSON.stringify({ image: { src: 'x' }, text: { headline: 'y' } });
    const result = parseConditionalFieldValue(inlineField, raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.image).toEqual({ src: 'x' });
    }
  });

  it('returns empty branches for null when not required', () => {
    const result = parseConditionalFieldValue(inlineField, null);
    expect(result).toEqual({
      ok: true,
      value: { image: {}, text: {} },
    });
  });

  it('returns error for null when required', () => {
    const result = parseConditionalFieldValue(requiredField, null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('required');
    }
  });

  it('returns error for non-object values', () => {
    const result = parseConditionalFieldValue(inlineField, [1, 2]);
    expect(result.ok).toBe(false);
  });

  it('returns error for invalid JSON string', () => {
    const result = parseConditionalFieldValue(inlineField, '{bad json');
    expect(result.ok).toBe(false);
  });

  it('handles reference branch empty value', () => {
    const result = parseConditionalFieldValue(mixedField, null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.inline).toEqual({});
      expect(result.value.ref).toBe('');
    }
  });
});

// ---------------------------------------------------------------------------
// validateConditionalConfig
// ---------------------------------------------------------------------------

describe('validateConditionalConfig', () => {
  it('returns null for valid config', () => {
    expect(validateConditionalConfig(inlineField)).toBeNull();
    expect(validateConditionalConfig(mixedField)).toBeNull();
  });

  it('rejects empty branches', () => {
    const field = {
      ...inlineField,
      conditional: { branches: [] },
    } as ConditionalCollectionField;
    expect(validateConditionalConfig(field)).toContain('at least one branch');
  });

  it('rejects duplicate keys', () => {
    const field: ConditionalCollectionField = {
      format: 'conditional',
      label: 'Dup',
      conditional: {
        branches: [
          { key: 'a', label: 'A', fields: { x: { format: 'string', label: 'X' } } },
          { key: 'a', label: 'A2', fields: { y: { format: 'string', label: 'Y' } } },
        ],
      },
    };
    expect(validateConditionalConfig(field)).toContain('duplicate');
  });

  it('rejects branch without fields or collection', () => {
    const field: ConditionalCollectionField = {
      format: 'conditional',
      label: 'Bad',
      conditional: {
        branches: [{ key: 'empty', label: 'Empty' } as any],
      },
    };
    expect(validateConditionalConfig(field)).toContain('fields or collection');
  });
});

// ---------------------------------------------------------------------------
// getBranchConfig
// ---------------------------------------------------------------------------

describe('getBranchConfig', () => {
  it('returns the matching branch', () => {
    expect(getBranchConfig(inlineField, 'image')?.label).toBe('Image Hero');
    expect(getBranchConfig(inlineField, 'text')?.label).toBe('Text Hero');
  });

  it('returns undefined for unknown key', () => {
    expect(getBranchConfig(inlineField, 'missing')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getInlineBranchFields / isReferenceBranch
// ---------------------------------------------------------------------------

describe('getInlineBranchFields', () => {
  it('returns fields for inline branch', () => {
    const branch = mixedField.conditional.branches[0];
    expect(getInlineBranchFields(branch)).toEqual({ title: { format: 'string', label: 'Title' } });
  });

  it('returns null for reference branch', () => {
    const branch = mixedField.conditional.branches[1];
    expect(getInlineBranchFields(branch)).toBeNull();
  });
});

describe('isReferenceBranch', () => {
  it('returns true for reference branches', () => {
    expect(isReferenceBranch(mixedField.conditional.branches[1])).toBe(true);
  });

  it('returns false for inline branches', () => {
    expect(isReferenceBranch(mixedField.conditional.branches[0])).toBe(false);
  });
});
