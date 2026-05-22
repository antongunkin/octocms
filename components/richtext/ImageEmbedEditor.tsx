'use client';

import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Upload, X } from 'lucide-react';
import type { JsxEditorProps } from '@mdxeditor/editor';
import { useMdastNodeUpdater } from '@mdxeditor/editor';

import { uploadMedia } from '../../admin/actions';
import { queryKeys } from '../../admin/query/keys';
import { useMediaList } from '../../admin/query/hooks/useMediaList';
import { useConfig } from '../../hooks/useConfig';
import { toast } from '../../hooks/useToast';
import type { MediaFile } from '../../types';
import { suggestedTitleFromFileName } from '../../lib/suggestedMediaTitle';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui';
import { Label } from '../ui/label';

const ImageEmbedEditor: React.FC<JsxEditorProps> = ({ mdastNode }) => {
  const config = useConfig();
  const queryClient = useQueryClient();
  const updateNode = useMdastNodeUpdater();
  const mediaIdAttr = mdastNode.attributes?.find((a: any) => a.type === 'mdxJsxAttribute' && a.name === 'mediaId');
  const currentMediaId = typeof mediaIdAttr?.value === 'string' ? mediaIdAttr.value : '';

  const [isOpen, setIsOpen] = useState(false);
  const { data: mediaEntries = [], refetch: refetchMedia } = useMediaList({ enabled: isOpen });
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');

  const selectedEntry = mediaEntries.find((e) => e.id === currentMediaId);

  useEffect(() => {
    if (!isOpen) return;
    void refetchMedia();
  }, [isOpen, refetchMedia]);

  const updateMediaId = useCallback(
    (newId: string) => {
      updateNode({
        attributes: [{ type: 'mdxJsxAttribute', name: 'mediaId', value: newId }],
      } as any);
    },
    [updateNode],
  );

  const handleSelect = useCallback(
    (entry: MediaFile) => {
      updateMediaId(entry.id);
      setIsOpen(false);
    },
    [updateMediaId],
  );

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
      await queryClient.invalidateQueries({ queryKey: queryKeys.media.list() });
      updateMediaId(mediaId);
      setStagedFile(null);
      setUploadTitle('');
      setIsOpen(false);
      toast({ title: `Uploaded "${file.name}"`, variant: 'success' });
    });
  }, [stagedFile, uploadTitle, selectedFolder, updateMediaId, queryClient]);

  const folders = [...new Set(mediaEntries.map((f) => f.folder))];
  const filteredEntries = selectedFolder ? mediaEntries.filter((f) => f.folder === selectedFolder) : mediaEntries;

  return (
    <div className="octo-image-embed" contentEditable={false}>
      {currentMediaId && selectedEntry ? (
        <div className="octo-image-embed__selected">
          <div className="octo-image-embed__thumb-wrap">
            <img
              src={selectedEntry.publicUrl}
              alt={selectedEntry.title || selectedEntry.originalName || ''}
              className="octo-image-embed__thumb"
            />
            <button type="button" onClick={() => updateMediaId('')} className="octo-image-embed__clear">
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <div className="octo-image-embed__info">
            <span className="octo-image-embed__info-label">Image embed</span>
            <span className="octo-image-embed__info-name">{selectedEntry.title || selectedEntry.originalName}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
              Change image
            </Button>
          </div>
        </div>
      ) : (
        <div className="octo-image-embed__empty-state">
          <div className="octo-image-embed__placeholder">
            <ImageIcon className="octo-image-embed__placeholder-icon" style={{ width: 24, height: 24 }} />
          </div>
          <div>
            <span className="octo-image-embed__no-label">No image selected</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
              Select image
            </Button>
          </div>
        </div>
      )}

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
                  <Label htmlFor="richtext-image-upload-title" className="text-sm">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <input
                    id="richtext-image-upload-title"
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
                  const isSelected = currentMediaId === entry.id;
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

export default ImageEmbedEditor;
