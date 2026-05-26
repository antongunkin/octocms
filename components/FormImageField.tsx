'use client';

import { Button, Icon } from './ui';
import React, { useCallback, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../admin/query/keys';
import { useMediaList } from '../admin/query/hooks/useMediaList';
import { useConfig } from '../hooks/useConfig';
import { toast } from '../hooks/useToast';
import { stageMediaFiles } from '../lib/stageMediaFiles';
import type { MediaFile } from '../types';

import { FieldHintAndError } from './FieldHintAndError';
import { MediaSelectDialog } from './MediaManager/MediaSelectDialog';
import { MediaUploadDialog } from './MediaManager/MediaUploadDialog';

type FormImageFieldProps = {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  hint?: string;
  error?: string;
  onClearError?: (name: string) => void;
  /**
   * Notification callbacks. Existing callers (entry editor) ignore them; the
   * markdown insert-image dialog uses both to publish `saveImage$` with full
   * extension / publicUrl info that's only available at the moment of pick.
   */
  onPick?: (file: MediaFile) => void;
  onUpload?: (uploadedIds: string[], stagedFiles: File[]) => void;
};

const FormImageField = ({
  label,
  name,
  value,
  required,
  hint,
  error,
  onClearError,
  onPick,
  onUpload,
}: FormImageFieldProps) => {
  const config = useConfig();
  const queryClient = useQueryClient();
  const mediaList = useMediaList();
  const [selected, setSelected] = useState(value || '');
  const [pendingUpload, setPendingUpload] = useState<File[] | null>(null);
  const [showSelectDialog, setShowSelectDialog] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const mediaEntries = mediaList.data ?? [];

  const selectedEntry = mediaEntries.find((e) => e.id === selected);
  const previewUrl = selectedEntry?.publicUrl || '';

  const stageFilesFromList = useCallback(
    (fileList: FileList) => {
      const { accepted, skipped } = stageMediaFiles(fileList, config.mediaAllowedFormats);
      for (const { name, ext } of skipped) {
        toast({ title: `Skipped "${name}" — format .${ext} not allowed`, variant: 'destructive' });
      }
      if (accepted.length > 0) setPendingUpload(accepted);
    },
    [config.mediaAllowedFormats],
  );

  const handleUploadComplete = useCallback(
    async (uploadedIds: string[]) => {
      if (uploadedIds.length === 0) {
        setPendingUpload(null);
        return;
      }
      const staged = pendingUpload ?? [];
      onUpload?.(uploadedIds, staged);
      await queryClient.invalidateQueries({ queryKey: queryKeys.media.list() });
      setSelected(uploadedIds[0]);
      setPendingUpload(null);
      onClearError?.(name);
    },
    [name, onClearError, onUpload, pendingUpload, queryClient],
  );

  const handlePickExisting = useCallback(
    (file: MediaFile) => {
      onPick?.(file);
      setSelected(file.id);
      onClearError?.(name);
    },
    [name, onClearError, onPick],
  );

  return (
    <div className="octo-ff-image">
      <div className="octo-ff-image__label">
        {label}
        {required ? <span className="octo-ff-image__required">*</span> : null}
      </div>
      <div className="octo-ff-image__body">
        {selected && previewUrl ? (
          <div className="octo-ff-image__preview">
            <img
              src={previewUrl}
              alt={selectedEntry?.title || selectedEntry?.originalName || ''}
              className="octo-ff-image__preview-img"
            />
            <button
              type="button"
              onClick={() => {
                setSelected('');
                onClearError?.(name);
              }}
              className="octo-ff-image__clear"
              aria-label="Remove image"
            >
              <Icon.X className="octo-icon-sm" />
            </button>
          </div>
        ) : (
          <div className="octo-ff-image__empty">
            <Icon.Image className="octo-icon-xl" />
          </div>
        )}
        <div className="octo-ff-image__actions">
          <Button type="button" variant="outline" onClick={() => uploadInputRef.current?.click()}>
            <Icon.Upload className="octo-icon-md" />
            Upload new image
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowSelectDialog(true)}>
            <Icon.ImagePlus className="octo-icon-md" />
            Select existing image
          </Button>
        </div>
        {selected && selectedEntry && (
          <span className="octo-ff-image__meta">
            {selectedEntry.title ? <div>{selectedEntry.title}</div> : null}
            {selectedEntry.originalName}
          </span>
        )}
      </div>
      <input type="hidden" name={name} value={selected} />

      <input
        ref={uploadInputRef}
        type="file"
        accept={config.mediaAllowedFormats.map((f) => `.${f}`).join(',')}
        className="octo-u-hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) stageFilesFromList(e.target.files);
          e.target.value = '';
        }}
      />

      <FieldHintAndError hint={hint} error={error} />

      <MediaUploadDialog
        files={pendingUpload}
        defaultFolder={'/'}
        onComplete={handleUploadComplete}
        onCancel={() => setPendingUpload(null)}
      />

      <MediaSelectDialog
        open={showSelectDialog}
        onOpenChange={setShowSelectDialog}
        selectedId={selected || undefined}
        onSelect={handlePickExisting}
      />
    </div>
  );
};

export default FormImageField;
