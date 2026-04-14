'use client';

import { ImageIcon, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { getMediaEntries, uploadMedia } from '../admin/actions';
import { useConfig } from '../hooks/useConfig';
import { toast } from '../hooks/useToast';
import type { MediaFile } from '../types';
import { suggestedTitleFromFileName } from '../lib/suggestedMediaTitle';

import { FieldHintAndError } from './FieldHintAndError';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui';
import { Label } from './ui/label';

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
  const [isOpen, setIsOpen] = useState(false);
  const [mediaEntries, setMediaEntries] = useState<MediaFile[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');

  useEffect(() => {
    getMediaEntries().then(setMediaEntries);
  }, []);

  const selectedEntry = mediaEntries.find((e) => e.id === selected);
  const previewUrl = selectedEntry?.publicUrl || '';

  const folders = [...new Set(mediaEntries.map((f) => f.folder))];
  const filteredEntries = selectedFolder ? mediaEntries.filter((f) => f.folder === selectedFolder) : mediaEntries;

  const handleSelect = (entry: MediaFile) => {
    setSelected(entry.id);
    setIsOpen(false);
    onClearError?.(name);
  };

  const stageFileFromList = useCallback(
    (fileList: FileList) => {
      const file = fileList[0];
      if (!file) return;
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!config.mediaAllowedFormats.includes(ext)) {
        toast({ title: `Format .${ext} not allowed`, variant: 'destructive' });
        return;
      }
      setStagedFile(file);
      setUploadTitle(suggestedTitleFromFileName(file.name));
    },
    [config.mediaAllowedFormats],
  );

  const confirmStagedUpload = useCallback(() => {
    if (!stagedFile) return;
    const title = uploadTitle.trim();
    if (!title) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }
    const file = stagedFile;

    const formData = new FormData();
    formData.set('file', file);
    formData.set('folder', selectedFolder || '/');
    formData.set('title', title);

    startTransition(async () => {
      const uploadResult = await uploadMedia(formData);

      if (!uploadResult.success) {
        toast({ title: uploadResult.error, variant: 'destructive' });
        return;
      }

      const mediaId = uploadResult.id;
      const fresh = await getMediaEntries();
      setMediaEntries(fresh);
      setSelected(mediaId);
      setStagedFile(null);
      setUploadTitle('');
      setIsOpen(false);
      onClearError?.(name);
      toast({ title: `Uploaded "${file.name}"`, variant: 'success' });
    });
  }, [stagedFile, uploadTitle, selectedFolder, name, onClearError]);

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
          <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
            {selected ? 'Change image' : 'Select image'}
          </Button>
          {selected && selectedEntry && (
            <span className="text-xs text-muted-foreground break-all">
              {selectedEntry.title ? `${selectedEntry.title} · ` : null}
              {selectedEntry.originalName}
            </span>
          )}
        </div>
      </div>
      <input type="hidden" name={name} value={selected} />

      <FieldHintAndError hint={hint} error={error} />

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setStagedFile(null);
            setUploadTitle('');
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select or upload image</DialogTitle>
          </DialogHeader>
          <div className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col gap-3">
            <input
              ref={uploadInputRef}
              type="file"
              accept={config.mediaAllowedFormats.map((f) => `.${f}`).join(',')}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) stageFileFromList(e.target.files);
                e.target.value = '';
              }}
            />
            {!stagedFile ? (
              <div className="flex items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isPending}
                >
                  <Upload className="w-4 h-4" />
                  Choose file to upload
                </Button>
              </div>
            ) : (
              <div className="space-y-3 max-w-md">
                <p className="text-sm text-muted-foreground break-all">{stagedFile.name}</p>
                <div>
                  <Label htmlFor={`${name}-upload-title`} className="text-sm">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <input
                    id={`${name}-upload-title`}
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="mt-1 w-full text-sm px-2 py-1.5 rounded border border-border bg-layout-bg"
                    placeholder="Shown as default alt text when this image is used"
                    disabled={isPending}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={confirmStagedUpload} disabled={isPending}>
                    Upload
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStagedFile(null);
                      setUploadTitle('');
                    }}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {isPending && <span className="text-xs text-muted-foreground">Uploading...</span>}
          </div>
          <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
            {folders.length > 1 && (
              <div className="w-36 flex-none overflow-y-auto border-r border-border pr-2">
                <button
                  type="button"
                  onClick={() => setSelectedFolder(null)}
                  className={`block w-full text-left px-2 py-1.5 rounded text-sm ${selectedFolder === null ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  All
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => setSelectedFolder(folder)}
                    className={`block w-full text-left px-2 py-1.5 rounded text-sm ${selectedFolder === folder ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  >
                    {folder === '/' ? 'Root' : folder}
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                {filteredEntries.map((entry) => {
                  const isSelected = selected === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => handleSelect(entry)}
                      className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'}`}
                    >
                      <img
                        src={entry.publicUrl}
                        alt={entry.title || entry.originalName}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1">
                        <span className="text-xs text-white truncate block">{entry.title || entry.originalName}</span>
                      </div>
                    </button>
                  );
                })}
                {filteredEntries.length === 0 && (
                  <div className="col-span-3 text-center py-12 text-muted-foreground">No images found</div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormImageField;
