'use server';

import type { EntryStatus } from '../../types';
import { getFile, saveFile } from './files';
import { actionErr, type ActionResult } from './utils';

/**
 * Set an entry's status to `published`. Valid from `draft` or `changed`.
 * Saves the entry with `skipStatusTransition` so the auto `published→changed` logic is bypassed.
 */
export const publishEntry = async (fileName: string): Promise<ActionResult> => {
  try {
    const entry = await getFile(fileName);
    if (!entry) return actionErr(new Error('Entry not found'));

    const currentStatus: EntryStatus = entry.sys?.status || 'merged';
    if (currentStatus === 'archived') {
      return actionErr(new Error('Cannot publish an archived entry. Restore it first.'));
    }

    const updated = { ...entry, sys: { ...entry.sys, status: 'published' } };
    return saveFile(updated, fileName, { skipStatusTransition: true });
  } catch (e) {
    return actionErr(e);
  }
};

/**
 * Soft-delete an entry by setting its status to `archived`.
 * Valid from any status. Archived entries are hidden from public pages and dimmed in admin lists.
 */
export const archiveEntry = async (fileName: string): Promise<ActionResult> => {
  try {
    const entry = await getFile(fileName);
    if (!entry) return actionErr(new Error('Entry not found'));

    const updated = { ...entry, sys: { ...entry.sys, status: 'archived' } };
    return saveFile(updated, fileName, { skipStatusTransition: true });
  } catch (e) {
    return actionErr(e);
  }
};

/**
 * Restore an archived entry by setting its status back to `draft`.
 * Only valid from `archived` status.
 */
export const restoreEntry = async (fileName: string): Promise<ActionResult> => {
  try {
    const entry = await getFile(fileName);
    if (!entry) return actionErr(new Error('Entry not found'));

    const currentStatus: EntryStatus = entry.sys?.status || 'merged';
    if (currentStatus !== 'archived') {
      return actionErr(new Error('Only archived entries can be restored.'));
    }

    const updated = { ...entry, sys: { ...entry.sys, status: 'draft' } };
    return saveFile(updated, fileName, { skipStatusTransition: true });
  } catch (e) {
    return actionErr(e);
  }
};
