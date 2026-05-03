'use client';

import { ImageIcon, ImagePlus, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { getMediaEntries } from '../admin/actions';
import { useConfig } from '../hooks/useConfig';
import { toast } from '../hooks/useToast';
import type { MediaFile } from '../types';

import { FieldHintAndError } from './FieldHintAndError';
import { MediaSelectDialog } from './MediaManager/MediaSelectDialog';
import { MediaUploadDialog } from './MediaManager/MediaUploadDialog';
import { Button } from './ui/button';

type FormImageFieldProps = {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  hint?: string;
  error?: string;
  onClearError?: (name: string) => void;
};

const FormImageField = ({ label, name, value, required, hint, error, onClearError }: FormImageFieldProps) => {
  const config = useConfig();
  const [selected, setSelected] = useState(value || '');
  const [mediaEntries, setMediaEntries] = useState<MediaFile[]>([]);
  const [pendingUpload, setPendingUpload] = useState<File[] | null>(null);
  const [showSelectDialog, setShowSelectDialog] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMediaEntries().then(setMediaEntries);
  }, []);

  const selectedEntry = mediaEntries.find((e) => e.id === selected);
  const previewUrl = selectedEntry?.publicUrl || '';

  const stageFilesFromList = useCallback(
    (fileList: FileList) => {
      const accepted: File[] = [];
      for (const file of Array.from(fileList)) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (!config.mediaAllowedFormats.includes(ext)) {
          toast({ title: `Skipped "${file.name}" — format .${ext} not allowed`, variant: 'destructive' });
          continue;
        }
        accepted.push(file);
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
      const fresh = await getMediaEntries();
      setMediaEntries(fresh);
      // First uploaded id wins as the field value (single-image field).
      setSelected(uploadedIds[0]);
      setPendingUpload(null);
      onClearError?.(name);
    },
    [name, onClearError],
  );

  const handlePickExisting = useCallback(
    (file: MediaFile) => {
      setSelected(file.id);
      onClearError?.(name);
    },
    [name, onClearError],
  );

  return (
    <div className="mb-6">
      <div className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
        {required ? <span className="text-destructive ml-1">*</span> : null}
      </div>
      <div className="flex items-start gap-4">
        {selected && previewUrl ? (
          <div className="relative w-40 h-28 rounded-lg border border-border overflow-hidden bg-muted flex-none">
            <img
              src={previewUrl}
              alt={selectedEntry?.title || selectedEntry?.originalName || ''}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => {
                setSelected('');
                onClearError?.(name);
              }}
              className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-0.5 hover:bg-black/80"
              aria-label="Remove image"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="w-40 h-28 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50 flex-none">
            <ImageIcon className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        <div className="flex flex-col gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={() => uploadInputRef.current?.click()}>
            <Upload className="w-4 h-4" />
            Upload new image
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowSelectDialog(true)}>
            <ImagePlus className="w-4 h-4" />
            Select existing image
          </Button>
        </div>
        {selected && selectedEntry && (
          <span className="text-xs text-muted-foreground break-all">
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
        className="hidden"
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
