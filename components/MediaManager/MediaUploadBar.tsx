'use client';

import { CloudUpload } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { cn } from '../../lib/utils';

export type MediaUploadBarProps = {
  allowedFormats: string[];
  onFiles: (files: FileList) => void;
  disabled?: boolean;
};

export function MediaUploadBar({ allowedFormats, onFiles, disabled }: MediaUploadBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const accept = allowedFormats.map((f) => `.${f}`).join(',');

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
    },
    [onFiles],
  );

  const openPicker = () => inputRef.current?.click();

  const formatHint = allowedFormats.length > 0 ? allowedFormats.map((f) => f.toUpperCase()).join(', ') : 'any';

  return (
    <div className="px-6 pt-4">
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'flex w-full items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-5 text-sm transition-colors',
          isDragging
            ? 'border-primary bg-[var(--surface-3)] text-foreground'
            : 'border-border bg-[var(--surface-1)] text-[var(--text-2)] hover:border-foreground/40 hover:text-foreground',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <CloudUpload className="h-5 w-5 shrink-0" />
        <span className="text-left">
          <span className="font-medium text-foreground">
            {isDragging ? 'Drop files to upload' : 'Drop images here or click to browse'}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">{formatHint}</span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
