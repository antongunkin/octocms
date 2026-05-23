'use client';

import { Image as ImageIcon } from '../ui/icons';
import { useRouter } from 'next/navigation';
import React from 'react';

import { cn } from '../../lib/utils';
import type { MediaFile } from '../../types';

export type MediaListTableProps = {
  files: MediaFile[];
  /** Optional row-pick callback. When set, rows fire this instead of routing
   *  to `/cms/media/<id>` — used by the "Select existing image" dialog. */
  onPickFile?: (file: MediaFile) => void;
  /** Highlights the matching row when supplied. */
  selectedId?: string;
};

function rowActivateKey(e: React.KeyboardEvent): boolean {
  return e.key === 'Enter' || e.key === ' ';
}

export function MediaListTable({ files, onPickFile, selectedId }: MediaListTableProps) {
  const router = useRouter();
  const activate = (file: MediaFile) => {
    if (onPickFile) onPickFile(file);
    else router.push(`/cms/media/${file.id}`);
  };

  return (
    <div className="octo-content-card">
      <div className="octo-content-card__scroll">
        <table className="octo-content-card__table">
          <thead className="octo-content-card__thead">
            <tr className="octo-content-card__th-row">
              <th className="octo-content-card__th">Title</th>
              <th className="octo-content-card__th">Folder</th>
              <th className="octo-content-card__th">Format</th>
              <th className="octo-content-card__th">Dimensions</th>
              <th className="octo-content-card__th">File name</th>
            </tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr>
                <td colSpan={5} className="octo-content-row__empty">
                  No files in this folder.
                </td>
              </tr>
            ) : (
              files.map((file) => (
                <tr
                  key={file.id}
                  tabIndex={0}
                  onClick={() => activate(file)}
                  onKeyDown={(e) => {
                    if (!rowActivateKey(e)) return;
                    e.preventDefault();
                    activate(file);
                  }}
                  className={cn(
                    'octo-content-row',
                    selectedId === file.id && 'octo-content-row octo-content-row--selected',
                  )}
                >
                  <td className="octo-content-row__td">
                    <span className="octo-content-row__thumb-wrap">
                      <span className="octo-content-row__thumb" style={{ width: '36px', height: '36px' }}>
                        <img src={file.publicUrl} alt="" loading="lazy" />
                      </span>
                      <span className="octo-content-row__title">{file.title || file.originalName}</span>
                    </span>
                  </td>
                  <td className="octo-content-row__td octo-content-row__meta">
                    {file.folder === '/' ? 'Root' : file.folder}
                  </td>
                  <td className="octo-content-row__td octo-content-row__meta">{file.extension.toUpperCase()}</td>
                  <td className="octo-content-row__td octo-content-row__meta">
                    {file.width != null && file.height != null ? `${file.width} × ${file.height}` : '—'}
                  </td>
                  <td className="octo-content-row__td octo-content-row__meta octo-u-mono octo-u-text-sm">
                    <span className="octo-u-flex octo-u-gap-1-5">
                      <ImageIcon className="octo-icon-sm octo-u-shrink-0 octo-u-opacity-60" />
                      <span className="octo-u-truncate">{file.originalName}</span>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
