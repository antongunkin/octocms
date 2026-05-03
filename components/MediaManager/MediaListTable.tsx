'use client';

import { Image as ImageIcon } from 'lucide-react';
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
    <div className="overflow-hidden rounded-xl border border-border bg-[var(--surface-1)] shadow-[var(--shadow-1)]">
      <div className="overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-[var(--surface-2)]">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Title
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Folder
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Format
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Dimensions
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                File name
              </th>
            </tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr>
                <td colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
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
                    'cursor-pointer border-b border-border transition-colors hover:bg-[var(--surface-2)]',
                    selectedId === file.id && 'bg-[var(--surface-2)]',
                  )}
                >
                  <td className="px-4 py-2.5 text-sm font-medium text-foreground">
                    <span className="inline-flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-[var(--surface-2)] text-muted-foreground">
                        <img src={file.publicUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </span>
                      <span className="truncate">{file.title || file.originalName}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground">
                    {file.folder === '/' ? 'Root' : file.folder}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground">{file.extension.toUpperCase()}</td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground">
                    {file.width != null && file.height != null ? `${file.width} × ${file.height}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{file.originalName}</span>
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
