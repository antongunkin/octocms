import { describe, expect, it } from 'vitest';

import {
  appendEntryPathToBranch,
  mergeHistoryContentWithAppendedEntry,
  parseBranchHistoryFile,
  serializeBranchHistoryFile,
  upsertBranchWorkspace,
} from './branchHistory';

describe('parseBranchHistoryFile', () => {
  it('returns empty object for empty or whitespace', () => {
    expect(parseBranchHistoryFile('')).toEqual({});
    expect(parseBranchHistoryFile('   \n')).toEqual({});
  });

  it('returns empty object for invalid JSON', () => {
    expect(parseBranchHistoryFile('{')).toEqual({});
  });

  it('returns empty object when shape is wrong', () => {
    expect(parseBranchHistoryFile(JSON.stringify({ foo: 'bar' }))).toEqual({});
    expect(parseBranchHistoryFile(JSON.stringify({ b: { title: 1, createdAt: 'x', entries: [] } }))).toEqual({});
  });

  it('parses valid file', () => {
    const raw = {
      'cms/edit-a': {
        title: 'A',
        createdAt: '2026-01-01T00:00:00.000Z',
        entries: ['cms/content/post/x.json'],
      },
    };
    expect(parseBranchHistoryFile(JSON.stringify(raw))).toEqual(raw);
  });

  it('accepts optional description', () => {
    const raw = {
      'cms/edit-b': {
        title: 'B',
        description: 'Note',
        createdAt: '2026-01-01T00:00:00.000Z',
        entries: [],
      },
    };
    expect(parseBranchHistoryFile(JSON.stringify(raw))).toEqual(raw);
  });
});

describe('serializeBranchHistoryFile', () => {
  it('round-trips with parse', () => {
    const data = {
      'cms/edit-x': {
        title: 'X',
        createdAt: '2026-04-10T12:00:00.000Z',
        entries: ['a.json'],
      },
    };
    const serialized = serializeBranchHistoryFile(data);
    expect(serialized.endsWith('\n')).toBe(true);
    expect(parseBranchHistoryFile(serialized)).toEqual(data);
  });
});

describe('upsertBranchWorkspace', () => {
  it('adds new branch with empty entries', () => {
    const next = upsertBranchWorkspace({}, 'cms/edit-1', {
      title: 'My work',
      description: 'Desc',
      createdAt: '2026-04-10T00:00:00.000Z',
    });
    expect(next['cms/edit-1']).toEqual({
      title: 'My work',
      description: 'Desc',
      createdAt: '2026-04-10T00:00:00.000Z',
      entries: [],
    });
  });

  it('preserves entries and createdAt when updating existing branch', () => {
    const prev = {
      'cms/edit-1': {
        title: 'Old',
        createdAt: '2026-01-01T00:00:00.000Z',
        entries: ['cms/content/post/p.json'],
      },
      other: {
        title: 'O',
        createdAt: '2026-02-01T00:00:00.000Z',
        entries: [],
      },
    };
    const next = upsertBranchWorkspace(prev, 'cms/edit-1', {
      title: 'New title',
      createdAt: '2099-01-01T00:00:00.000Z',
    });
    expect(next.other).toEqual(prev.other);
    expect(next['cms/edit-1']).toEqual({
      title: 'New title',
      createdAt: '2026-01-01T00:00:00.000Z',
      entries: ['cms/content/post/p.json'],
    });
  });

  it('drops description when new input has none and existing had none', () => {
    const prev = {
      b: {
        title: 'T',
        createdAt: '2026-01-01T00:00:00.000Z',
        entries: [],
      },
    };
    const next = upsertBranchWorkspace(prev, 'b', {
      title: 'T2',
      createdAt: 'ignored',
    });
    expect(next.b.description).toBeUndefined();
  });
});

describe('mergeHistoryContentWithAppendedEntry', () => {
  it('returns null when branch is unknown', () => {
    expect(mergeHistoryContentWithAppendedEntry('{}', 'missing', 'a.json')).toBeNull();
  });

  it('returns null when path already listed', () => {
    const raw = JSON.stringify({
      br: { title: 'x', createdAt: '2026-01-01T00:00:00.000Z', entries: ['a.json'] },
    });
    expect(mergeHistoryContentWithAppendedEntry(raw, 'br', 'a.json')).toBeNull();
  });

  it('returns serialized file when path is new', () => {
    const raw = JSON.stringify({
      br: { title: 'x', createdAt: '2026-01-01T00:00:00.000Z', entries: ['a.json'] },
    });
    const next = mergeHistoryContentWithAppendedEntry(raw, 'br', 'b.json');
    expect(next).not.toBeNull();
    expect(parseBranchHistoryFile(next!)).toMatchObject({
      br: { entries: ['a.json', 'b.json'] },
    });
  });
});

describe('appendEntryPathToBranch', () => {
  it('no-op when branch missing', () => {
    const data = {};
    expect(appendEntryPathToBranch(data, 'missing', 'a.json')).toBe(data);
  });

  it('appends unique paths', () => {
    const data = {
      br: {
        title: 'x',
        createdAt: '2026-01-01T00:00:00.000Z',
        entries: ['a.json'],
      },
    };
    const next = appendEntryPathToBranch(data, 'br', 'b.json');
    expect(next.br.entries).toEqual(['a.json', 'b.json']);
    const again = appendEntryPathToBranch(next, 'br', 'b.json');
    expect(again.br.entries).toEqual(['a.json', 'b.json']);
  });
});
