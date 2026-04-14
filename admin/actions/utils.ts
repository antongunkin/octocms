import { getConfig } from '../../lib/configStore';
import type { Config } from '../types';

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

/** Standard result for CMS server actions — use for user-facing feedback (toast). */
export type ActionResult = { success: true } | { success: false; error: string };

/** `saveFile` may attach per-field errors (e.g. duplicate slug). */
export type SaveFileResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export const actionOk = (): { success: true } => ({ success: true });

export const actionErr = (error: unknown): { success: false; error: string } => ({
  success: false,
  error: getErrorMessage(error),
});

export type NewFileResult = { success: true; path: string } | { success: false; error: string };

export type UploadMediaResult = { success: true; id: string } | { success: false; error: string };

export type CreatePRResult = { success: true; url: string; number: number } | { success: false; error: string };

export type CreateBranchInput = {
  branchName: string;
  title: string;
  description?: string;
};

/** After a successful branch + metadata commit; `prUrl` may be empty if opening the draft PR failed. */
export type CreateBranchResult =
  | { success: true; prUrl: string; prWarning?: string }
  | { success: false; error: string };

export const getEntryTitleField = (collectionName: string): string | undefined => {
  const config = getConfig();
  const collection = config.collections[collectionName as keyof Config['collections']];

  if (!collection) return undefined;

  return Object.keys(collection.fields).find((key) => collection.fields[key].entryTitle);
};
