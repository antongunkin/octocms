import { z } from 'zod';

/** Repo path for CMS branch workspace metadata (committed on feature branches). */
export const BRANCH_HISTORY_FILE_PATH = 'cms/branch-history.json';

const branchWorkspaceSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  entries: z.array(z.string()),
});

export type BranchWorkspaceRecord = z.infer<typeof branchWorkspaceSchema>;

/** Maps Git branch name → workspace metadata. */
export type BranchHistoryFile = Record<string, BranchWorkspaceRecord>;

const rootSchema = z.record(z.string(), branchWorkspaceSchema);

export const parseBranchHistoryFile = (content: string): BranchHistoryFile => {
  const trimmed = content.trim();
  if (!trimmed) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    const result = rootSchema.safeParse(parsed);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
};

export const serializeBranchHistoryFile = (data: BranchHistoryFile): string => `${JSON.stringify(data, null, 2)}\n`;

export type UpsertBranchWorkspaceInput = {
  title: string;
  description?: string;
  createdAt: string;
};

/**
 * Add or update a branch workspace. If the branch key already exists, preserves `entries`
 * and the original `createdAt`; updates `title` and optional `description`.
 */
export const upsertBranchWorkspace = (
  data: BranchHistoryFile,
  branchName: string,
  input: UpsertBranchWorkspaceInput,
): BranchHistoryFile => {
  const existing = data[branchName];

  if (existing) {
    return {
      ...data,
      [branchName]: {
        title: input.title,
        ...(input.description !== undefined && input.description !== ''
          ? { description: input.description }
          : existing.description !== undefined
            ? { description: existing.description }
            : {}),
        createdAt: existing.createdAt,
        entries: existing.entries,
      },
    };
  }

  return {
    ...data,
    [branchName]: {
      title: input.title,
      ...(input.description !== undefined && input.description !== '' ? { description: input.description } : {}),
      createdAt: input.createdAt,
      entries: [],
    },
  };
};

/** Append a content file path to the branch's `entries` if not already present. No-op if branch missing. */
export const appendEntryPathToBranch = (
  data: BranchHistoryFile,
  branchName: string,
  entryPath: string,
): BranchHistoryFile => {
  const existing = data[branchName];
  if (!existing) {
    return data;
  }

  if (existing.entries.includes(entryPath)) {
    return data;
  }

  return {
    ...data,
    [branchName]: {
      ...existing,
      entries: [...existing.entries, entryPath],
    },
  };
};

/** Returns serialized JSON or `null` if there is nothing to write (unknown branch or no new entry). */
export const mergeHistoryContentWithAppendedEntry = (
  content: string,
  branchName: string,
  entryPath: string,
): string | null => {
  const data = parseBranchHistoryFile(content);
  if (!data[branchName]) {
    return null;
  }

  const next = appendEntryPathToBranch(data, branchName, entryPath);
  if (next === data) {
    return null;
  }

  return serializeBranchHistoryFile(next);
};
