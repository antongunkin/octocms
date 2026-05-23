'use client';

import { CloudUpload } from '../ui/icons';
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
    <div className="octo-media-upload-bar">
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'octo-media-upload-bar__btn',
          isDragging && 'octo-media-upload-bar__btn octo-media-upload-bar__btn--dragging',
        )}
      >
        <CloudUpload className="octo-media-upload-bar__icon h-5 w-5" />
        <span>
          <span className="octo-media-upload-bar__label">
            {isDragging ? 'Drop files to upload' : 'Drop images here or click to browse'}
          </span>
          <span className="octo-media-upload-bar__hint">{formatHint}</span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
